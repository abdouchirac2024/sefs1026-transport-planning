import type { Vehicle } from '../domain/types';
import { apiFetch } from './http-client';

export function fetchActiveVehicles(): Promise<Vehicle[]> {
  return apiFetch<Vehicle[]>('/vehicles');
}
