import type { Page, SalesOrderToPlan } from '../domain/types';
import { apiFetch } from './http-client';

export function fetchSalesOrdersToPlan(params: {
  city?: string;
  page: number;
  pageSize: number;
}): Promise<Page<SalesOrderToPlan>> {
  return apiFetch<Page<SalesOrderToPlan>>('/sales-orders/to-plan', { query: params });
}

export function fetchCities(): Promise<string[]> {
  return apiFetch<string[]>('/sales-orders/cities');
}
