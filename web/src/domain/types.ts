export type Role = 'DISPATCHER' | 'LOGISTICS_MANAGER';

export interface User {
  id: string;
  role: Role;
}

export interface Vehicle {
  code: string;
  plateNo: string;
  capacityKg: number;
  active: boolean;
}

/** Statut d'une commande de vente : 0 = À planifier, 1 = Planifiée, 2 = En livraison. */
export type SalesOrderStatus = 0 | 1 | 2;

export interface SalesOrderToPlan {
  no: string;
  customerNo: string;
  customerName: string;
  deliveryCity: string;
  totalWeightKg: number;
  status: SalesOrderStatus;
}

/** Statut d'un ordre de transport : 0 = Brouillon, 1 = Validé, 2 = Parti. */
export type TransportOrderStatus = 0 | 1 | 2;

export interface TransportOrderListItem {
  no: string;
  vehicleCode: string;
  plateNo: string;
  capacityKg: number;
  deliveryDate: string;
  status: TransportOrderStatus;
  createdBy: string;
  validatedBy: string | null;
  version: string;
  totalWeightKg: number;
  lineCount: number;
}

export interface TransportOrderLine {
  salesOrderNo: string;
  customerName: string;
  deliveryCity: string;
  totalWeightKg: number;
}

export interface TransportOrderDetail extends TransportOrderListItem {
  remainingCapacityKg: number;
  lines: TransportOrderLine[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
