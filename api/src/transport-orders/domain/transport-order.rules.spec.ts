import { HttpStatus } from '@nestjs/common';
import { Role } from '../../auth/role.enum';
import { DomainError } from '../../common/errors/domain-error';
import { ErrorCode } from '../../common/errors/error-codes';
import {
  assertCanCreate,
  assertCanDepart,
  assertCanValidate,
  assertCapacity,
  assertEditable,
  assertPlannable,
  nextTransportOrderNo,
  SalesOrderStatus,
  TransportOrderStatus,
} from './transport-order.rules';

/** Exécute `fn`, attend qu'elle lève une DomainError, et la retourne pour inspection. */
function captureDomainError(fn: () => void): DomainError {
  try {
    fn();
  } catch (error) {
    if (error instanceof DomainError) {
      return error;
    }
    throw error;
  }
  throw new Error(
    'Aucune erreur levée alors qu une DomainError était attendue.',
  );
}

describe('assertCapacity', () => {
  it('accepte un poids strictement sous la capacité', () => {
    expect(() => assertCapacity(1500, 1360, 100)).not.toThrow();
  });

  it('accepte un poids exactement égal à la capacité (ne doit jamais dépasser, l égalité est permise)', () => {
    expect(() => assertCapacity(1500, 1360, 140)).not.toThrow();
  });

  it('refuse un dépassement de 0,01 kg', () => {
    const error = captureDomainError(() => assertCapacity(1500, 1360, 140.01));
    expect(error.code).toBe(ErrorCode.CAPACITY_EXCEEDED);
    expect(error.httpStatus).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
  });

  it('refuse un ajout multiple dont la somme dépasse la capacité (scénario TO-0003 : 1360 + 60,25 + 85)', () => {
    const error = captureDomainError(() =>
      assertCapacity(1500, 1360, 60.25 + 85),
    );
    expect(error.code).toBe(ErrorCode.CAPACITY_EXCEEDED);
    expect(error.httpStatus).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(error.details).toEqual({
      capacityKg: 1500,
      currentKg: 1360,
      addedKg: 145.25,
    });
  });

  it('accepte un ajout dont la somme tient exactement dans la capacité restante (1360 + 60,25 = 1420,25)', () => {
    expect(() => assertCapacity(1500, 1360, 60.25)).not.toThrow();
  });

  it('ne produit pas d erreur d arrondi flottant classique (0,1 + 0,2 doit être traité comme 0,3 exactement)', () => {
    // En JS, 0.1 + 0.2 === 0.30000000000000004 : une comparaison naïve rejetterait ce cas.
    expect(() => assertCapacity(0.3, 0.1, 0.2)).not.toThrow();
  });
});

describe('assertPlannable', () => {
  const planifiable: typeof SalesOrderStatus.TO_PLAN = SalesOrderStatus.TO_PLAN;

  it('accepte une liste de commandes toutes existantes et à planifier, sans doublon', () => {
    const found = [
      { no: 'SO-1027', status: planifiable },
      { no: 'SO-1040', status: planifiable },
    ];
    expect(() => assertPlannable(['SO-1027', 'SO-1040'], found)).not.toThrow();
  });

  it('refuse une liste vide', () => {
    const error = captureDomainError(() => assertPlannable([], []));
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.httpStatus).toBe(HttpStatus.BAD_REQUEST);
  });

  it('refuse des doublons dans la requête', () => {
    const found = [{ no: 'SO-1027', status: planifiable }];
    const error = captureDomainError(() =>
      assertPlannable(['SO-1027', 'SO-1027'], found),
    );
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.httpStatus).toBe(HttpStatus.BAD_REQUEST);
    expect(error.details).toEqual({ duplicates: ['SO-1027'] });
  });

  it('refuse une commande inexistante', () => {
    const error = captureDomainError(() => assertPlannable(['SO-9999'], []));
    expect(error.code).toBe(ErrorCode.SALES_ORDER_NOT_FOUND);
    expect(error.httpStatus).toBe(HttpStatus.NOT_FOUND);
    expect(error.details).toEqual({ missing: ['SO-9999'] });
  });

  it('refuse une commande déjà Planifiée (statut 1)', () => {
    const found = [{ no: 'SO-1003', status: SalesOrderStatus.PLANNED }];
    const error = captureDomainError(() => assertPlannable(['SO-1003'], found));
    expect(error.code).toBe(ErrorCode.SALES_ORDER_NOT_PLANNABLE);
    expect(error.httpStatus).toBe(HttpStatus.CONFLICT);
  });

  it('refuse une commande déjà En livraison (statut 2)', () => {
    const found = [{ no: 'SO-1001', status: SalesOrderStatus.IN_DELIVERY }];
    const error = captureDomainError(() => assertPlannable(['SO-1001'], found));
    expect(error.code).toBe(ErrorCode.SALES_ORDER_NOT_PLANNABLE);
    expect(error.httpStatus).toBe(HttpStatus.CONFLICT);
  });
});

describe('assertEditable', () => {
  it('accepte un ordre au statut Brouillon', () => {
    expect(() =>
      assertEditable({ status: TransportOrderStatus.DRAFT }),
    ).not.toThrow();
  });

  it('refuse l ajout/retrait sur un ordre Validé', () => {
    const error = captureDomainError(() =>
      assertEditable({ status: TransportOrderStatus.VALIDATED }),
    );
    expect(error.code).toBe(ErrorCode.ORDER_NOT_EDITABLE);
    expect(error.httpStatus).toBe(HttpStatus.CONFLICT);
  });

  it('refuse l ajout/retrait sur un ordre Parti', () => {
    const error = captureDomainError(() =>
      assertEditable({ status: TransportOrderStatus.DEPARTED }),
    );
    expect(error.code).toBe(ErrorCode.ORDER_NOT_EDITABLE);
    expect(error.httpStatus).toBe(HttpStatus.CONFLICT);
  });
});

describe('assertCanValidate', () => {
  it('accepte un ordre Brouillon non vide validé par un LOGISTICS_MANAGER', () => {
    expect(() =>
      assertCanValidate(
        { status: TransportOrderStatus.DRAFT, lineCount: 2 },
        Role.LOGISTICS_MANAGER,
      ),
    ).not.toThrow();
  });

  it('refuse la validation par un DISPATCHER', () => {
    const error = captureDomainError(() =>
      assertCanValidate(
        { status: TransportOrderStatus.DRAFT, lineCount: 2 },
        Role.DISPATCHER,
      ),
    );
    expect(error.code).toBe(ErrorCode.FORBIDDEN_ROLE);
    expect(error.httpStatus).toBe(HttpStatus.FORBIDDEN);
  });

  it('refuse la validation d un ordre vide (0 commande)', () => {
    const error = captureDomainError(() =>
      assertCanValidate(
        { status: TransportOrderStatus.DRAFT, lineCount: 0 },
        Role.LOGISTICS_MANAGER,
      ),
    );
    expect(error.code).toBe(ErrorCode.EMPTY_ORDER);
    expect(error.httpStatus).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
  });

  it('refuse la validation d un ordre déjà Validé', () => {
    const error = captureDomainError(() =>
      assertCanValidate(
        { status: TransportOrderStatus.VALIDATED, lineCount: 2 },
        Role.LOGISTICS_MANAGER,
      ),
    );
    expect(error.code).toBe(ErrorCode.INVALID_STATUS_TRANSITION);
    expect(error.httpStatus).toBe(HttpStatus.CONFLICT);
  });

  it('refuse la validation d un ordre déjà Parti', () => {
    const error = captureDomainError(() =>
      assertCanValidate(
        { status: TransportOrderStatus.DEPARTED, lineCount: 2 },
        Role.LOGISTICS_MANAGER,
      ),
    );
    expect(error.code).toBe(ErrorCode.INVALID_STATUS_TRANSITION);
    expect(error.httpStatus).toBe(HttpStatus.CONFLICT);
  });
});

describe('assertCanDepart', () => {
  it('accepte un ordre Validé', () => {
    expect(() =>
      assertCanDepart({ status: TransportOrderStatus.VALIDATED }),
    ).not.toThrow();
  });

  it('refuse le départ d un ordre encore au statut Brouillon', () => {
    const error = captureDomainError(() =>
      assertCanDepart({ status: TransportOrderStatus.DRAFT }),
    );
    expect(error.code).toBe(ErrorCode.INVALID_STATUS_TRANSITION);
    expect(error.httpStatus).toBe(HttpStatus.CONFLICT);
  });

  it('refuse le départ d un ordre déjà Parti', () => {
    const error = captureDomainError(() =>
      assertCanDepart({ status: TransportOrderStatus.DEPARTED }),
    );
    expect(error.code).toBe(ErrorCode.INVALID_STATUS_TRANSITION);
    expect(error.httpStatus).toBe(HttpStatus.CONFLICT);
  });
});

describe('assertCanCreate', () => {
  const activeVehicle = { active: true };

  it('accepte un véhicule actif, une date future, sans réservation existante', () => {
    expect(() =>
      assertCanCreate({
        vehicle: activeVehicle,
        deliveryDate: '2026-01-02',
        today: '2026-01-01',
        existingOrderForVehicleAndDate: false,
      }),
    ).not.toThrow();
  });

  it('accepte une date de livraison égale à aujourd hui', () => {
    expect(() =>
      assertCanCreate({
        vehicle: activeVehicle,
        deliveryDate: '2026-01-01',
        today: '2026-01-01',
        existingOrderForVehicleAndDate: false,
      }),
    ).not.toThrow();
  });

  it('refuse un véhicule introuvable', () => {
    const error = captureDomainError(() =>
      assertCanCreate({
        vehicle: null,
        deliveryDate: '2026-01-02',
        today: '2026-01-01',
        existingOrderForVehicleAndDate: false,
      }),
    );
    expect(error.code).toBe(ErrorCode.VEHICLE_NOT_FOUND);
    expect(error.httpStatus).toBe(HttpStatus.NOT_FOUND);
  });

  it('refuse un véhicule inactif', () => {
    const error = captureDomainError(() =>
      assertCanCreate({
        vehicle: { active: false },
        deliveryDate: '2026-01-02',
        today: '2026-01-01',
        existingOrderForVehicleAndDate: false,
      }),
    );
    expect(error.code).toBe(ErrorCode.VEHICLE_INACTIVE);
    expect(error.httpStatus).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
  });

  it('refuse une date de livraison dans le passé (hier)', () => {
    const error = captureDomainError(() =>
      assertCanCreate({
        vehicle: activeVehicle,
        deliveryDate: '2025-12-31',
        today: '2026-01-01',
        existingOrderForVehicleAndDate: false,
      }),
    );
    expect(error.code).toBe(ErrorCode.DELIVERY_DATE_IN_PAST);
    expect(error.httpStatus).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
  });

  it('refuse un véhicule déjà réservé à cette date', () => {
    const error = captureDomainError(() =>
      assertCanCreate({
        vehicle: activeVehicle,
        deliveryDate: '2026-01-02',
        today: '2026-01-01',
        existingOrderForVehicleAndDate: true,
      }),
    );
    expect(error.code).toBe(ErrorCode.VEHICLE_ALREADY_BOOKED);
    expect(error.httpStatus).toBe(HttpStatus.CONFLICT);
  });
});

describe('nextTransportOrderNo', () => {
  it('incrémente un numéro simple (TO-0004 -> TO-0005)', () => {
    expect(nextTransportOrderNo(4)).toBe('TO-0005');
  });

  it('passe au premier numéro à 5 chiffres sans troncature (TO-9999 -> TO-10000)', () => {
    expect(nextTransportOrderNo(9999)).toBe('TO-10000');
  });

  it('démarre à TO-0001 quand aucun ordre n existe (lastNumber = 0)', () => {
    expect(nextTransportOrderNo(0)).toBe('TO-0001');
  });
});
