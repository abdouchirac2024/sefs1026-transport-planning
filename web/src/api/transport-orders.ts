import type { Page, TransportOrderDetail, TransportOrderListItem } from '../domain/types';
import { apiFetch } from './http-client';

export function fetchTransportOrders(params: {
  status?: number;
  date?: string;
  page: number;
  pageSize: number;
}): Promise<Page<TransportOrderListItem>> {
  return apiFetch<Page<TransportOrderListItem>>('/transport-orders', { query: params });
}

export function fetchTransportOrder(no: string): Promise<TransportOrderDetail> {
  return apiFetch<TransportOrderDetail>(`/transport-orders/${encodeURIComponent(no)}`);
}

export function createTransportOrder(input: { vehicleCode: string; deliveryDate: string }): Promise<TransportOrderDetail> {
  return apiFetch<TransportOrderDetail>('/transport-orders', { method: 'POST', body: input });
}

export function addLines(no: string, salesOrderNos: string[], ifMatch?: string): Promise<TransportOrderDetail> {
  return apiFetch<TransportOrderDetail>(`/transport-orders/${encodeURIComponent(no)}/lines`, {
    method: 'POST',
    body: { salesOrderNos },
    ifMatch,
  });
}

export function removeLine(no: string, salesOrderNo: string, ifMatch?: string): Promise<TransportOrderDetail> {
  return apiFetch<TransportOrderDetail>(
    `/transport-orders/${encodeURIComponent(no)}/lines/${encodeURIComponent(salesOrderNo)}`,
    { method: 'DELETE', ifMatch },
  );
}

export function validateTransportOrder(no: string, ifMatch?: string): Promise<TransportOrderDetail> {
  return apiFetch<TransportOrderDetail>(`/transport-orders/${encodeURIComponent(no)}/validate`, {
    method: 'POST',
    ifMatch,
  });
}

export function departTransportOrder(no: string, ifMatch?: string): Promise<TransportOrderDetail> {
  return apiFetch<TransportOrderDetail>(`/transport-orders/${encodeURIComponent(no)}/depart`, {
    method: 'POST',
    ifMatch,
  });
}
