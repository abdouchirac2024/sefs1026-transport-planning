import { defineStore } from 'pinia';
import { ref } from 'vue';
import { toApiError, type ApiError } from '../api/http-client';
import { fetchActiveVehicles } from '../api/vehicles';
import type { Vehicle } from '../domain/types';

export const useVehiclesStore = defineStore('vehicles', () => {
  const vehicles = ref<Vehicle[]>([]);
  const loading = ref(false);
  const error = ref<ApiError | null>(null);
  let loaded = false;

  async function load(force = false): Promise<void> {
    if (loaded && !force) {
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      vehicles.value = await fetchActiveVehicles();
      loaded = true;
    } catch (e) {
      error.value = toApiError(e);
    } finally {
      loading.value = false;
    }
  }

  return { vehicles, loading, error, load };
});
