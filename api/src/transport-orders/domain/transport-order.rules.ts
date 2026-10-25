import { HttpStatus } from '@nestjs/common';
import { DomainError } from '../../common/errors/domain-error';
import { ErrorCode } from '../../common/errors/error-codes';
import { Role } from '../../auth/role.enum';

/**
 * Fonctions pures : aucune I/O, aucun accès base de données. Elles reçoivent un instantané
 * des données déjà chargées par le service (sous verrou) et lèvent une DomainError si une
 * règle métier est violée. Testables sans NestJS ni SQL Server.
 */

export enum SalesOrderStatus {
  TO_PLAN = 0,
  PLANNED = 1,
  IN_DELIVERY = 2,
}

export enum TransportOrderStatus {
  DRAFT = 0,
  VALIDATED = 1,
  DEPARTED = 2,
}

export interface VehicleSnapshot {
  active: boolean;
}

export interface SalesOrderSnapshot {
  no: string;
  status: SalesOrderStatus;
}

/** Compare les poids en centièmes entiers pour éviter les erreurs d'arrondi des nombres flottants. */
function toCents(kg: number): number {
  return Math.round(kg * 100);
}

/** Règle 1 : création au statut Brouillon, véhicule actif, date non passée, un seul ordre par véhicule et par date. */
export function assertCanCreate(input: {
  vehicle: VehicleSnapshot | null;
  deliveryDate: string;
  today: string;
  existingOrderForVehicleAndDate: boolean;
}): void {
  if (!input.vehicle) {
    throw new DomainError(
      ErrorCode.VEHICLE_NOT_FOUND,
      'Véhicule introuvable.',
      HttpStatus.NOT_FOUND,
    );
  }

  if (!input.vehicle.active) {
    throw new DomainError(
      ErrorCode.VEHICLE_INACTIVE,
      'Le véhicule est hors service.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  // Comparaison lexicale de chaînes YYYY-MM-DD : équivalente à une comparaison chronologique,
  // sans passer par un objet Date (donc sans risque de décalage de fuseau horaire).
  if (input.deliveryDate < input.today) {
    throw new DomainError(
      ErrorCode.DELIVERY_DATE_IN_PAST,
      'La date de livraison ne peut pas être dans le passé.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  if (input.existingOrderForVehicleAndDate) {
    throw new DomainError(
      ErrorCode.VEHICLE_ALREADY_BOOKED,
      'Ce véhicule a déjà un ordre de transport pour cette date.',
      HttpStatus.CONFLICT,
    );
  }
}

/** Règle 7 : ajout/retrait de commandes uniquement sur un ordre au statut Brouillon. */
export function assertEditable(order: { status: TransportOrderStatus }): void {
  if (order.status !== TransportOrderStatus.DRAFT) {
    throw new DomainError(
      ErrorCode.ORDER_NOT_EDITABLE,
      "L'ordre n'est plus modifiable (il n'est plus au statut Brouillon).",
      HttpStatus.CONFLICT,
    );
  }
}

/**
 * Règles 3 et 4 : seules les commandes À planifier peuvent être ajoutées, une commande ne peut
 * figurer que dans un seul ordre, ajout tout ou rien. `found` contient les commandes demandées
 * qui existent réellement en base (requêtées par le repository) ; celles qui manquent dans
 * `found` par rapport à `requestedNos` sont considérées introuvables.
 */
export function assertPlannable(
  requestedNos: string[],
  found: SalesOrderSnapshot[],
): void {
  if (requestedNos.length === 0) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'La liste de commandes à ajouter est vide.',
      HttpStatus.BAD_REQUEST,
    );
  }

  const duplicates = findDuplicates(requestedNos);
  if (duplicates.length > 0) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Commande(s) en double dans la requête : ${duplicates.join(', ')}.`,
      HttpStatus.BAD_REQUEST,
      { duplicates },
    );
  }

  const foundNos = new Set(found.map((so) => so.no));
  const missing = requestedNos.filter((no) => !foundNos.has(no));
  if (missing.length > 0) {
    throw new DomainError(
      ErrorCode.SALES_ORDER_NOT_FOUND,
      `Commande(s) introuvable(s) : ${missing.join(', ')}.`,
      HttpStatus.NOT_FOUND,
      { missing },
    );
  }

  const notPlannable = found.filter(
    (so) => so.status !== SalesOrderStatus.TO_PLAN,
  );
  if (notPlannable.length > 0) {
    throw new DomainError(
      ErrorCode.SALES_ORDER_NOT_PLANNABLE,
      `Commande(s) non planifiable(s) (déjà affectée(s) à un ordre ou en livraison) : ${notPlannable
        .map((so) => so.no)
        .join(', ')}.`,
      HttpStatus.CONFLICT,
      { salesOrderNos: notPlannable.map((so) => so.no) },
    );
  }
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates];
}

/** Règle 5 : le poids total ne doit jamais dépasser la capacité du véhicule (l'égalité est autorisée). */
export function assertCapacity(
  capacityKg: number,
  currentKg: number,
  addedKg: number,
): void {
  const totalCents = toCents(currentKg) + toCents(addedKg);
  if (totalCents > toCents(capacityKg)) {
    throw new DomainError(
      ErrorCode.CAPACITY_EXCEEDED,
      `Le poids total (${(totalCents / 100).toFixed(2)} kg) dépasse la capacité du véhicule (${capacityKg.toFixed(2)} kg).`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { capacityKg, currentKg, addedKg },
    );
  }
}

/** Règle 8 : seul un LOGISTICS_MANAGER valide, ordre non vide, ordre au statut Brouillon. */
export function assertCanValidate(
  order: { status: TransportOrderStatus; lineCount: number },
  role: Role,
): void {
  if (order.status !== TransportOrderStatus.DRAFT) {
    throw new DomainError(
      ErrorCode.INVALID_STATUS_TRANSITION,
      'Seul un ordre au statut Brouillon peut être validé.',
      HttpStatus.CONFLICT,
    );
  }

  if (role !== Role.LOGISTICS_MANAGER) {
    throw new DomainError(
      ErrorCode.FORBIDDEN_ROLE,
      'Seul un LOGISTICS_MANAGER peut valider un ordre de transport.',
      HttpStatus.FORBIDDEN,
    );
  }

  if (order.lineCount === 0) {
    throw new DomainError(
      ErrorCode.EMPTY_ORDER,
      'Un ordre sans commande ne peut pas être validé.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/** Règle 9 : un ordre Validé peut être marqué Parti. */
export function assertCanDepart(order: { status: TransportOrderStatus }): void {
  if (order.status !== TransportOrderStatus.VALIDATED) {
    throw new DomainError(
      ErrorCode.INVALID_STATUS_TRANSITION,
      'Seul un ordre Validé peut être marqué Parti.',
      HttpStatus.CONFLICT,
    );
  }
}

/** Numéro suivant au format TO-0005. Pas de padding si le numéro dépasse 4 chiffres (TO-10000). */
export function nextTransportOrderNo(lastNumber: number): string {
  return `TO-${String(lastNumber + 1).padStart(4, '0')}`;
}
