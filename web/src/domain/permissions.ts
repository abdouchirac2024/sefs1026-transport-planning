import type { Role, TransportOrderStatus } from './types';

/**
 * Fonctions pures : décident quels boutons afficher/activer selon le rôle et le statut.
 * Purement indicatif côté front -- l'API revérifie tout, quoi qu'il arrive ici.
 */

const DRAFT: TransportOrderStatus = 0;
const VALIDATED: TransportOrderStatus = 1;

export function canEditLines(order: { status: TransportOrderStatus }): boolean {
  return order.status === DRAFT;
}

export function canValidate(order: { status: TransportOrderStatus; lineCount: number }, role: Role): boolean {
  return order.status === DRAFT && order.lineCount >= 1 && role === 'LOGISTICS_MANAGER';
}

export function canDepart(order: { status: TransportOrderStatus }): boolean {
  return order.status === VALIDATED;
}
