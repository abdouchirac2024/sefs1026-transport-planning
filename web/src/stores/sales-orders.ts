import { defineStore } from 'pinia';
import { ref } from 'vue';
import { toApiError, type ApiError } from '../api/http-client';
import { fetchCities, fetchSalesOrdersToPlan } from '../api/sales-orders';
import type { SalesOrderToPlan } from '../domain/types';

export const useSalesOrdersStore = defineStore('salesOrders', () => {
  const items = ref<SalesOrderToPlan[]>([]);
  const total = ref(0);
  const page = ref(1);
  const pageSize = ref(20);
  const city = ref<string | undefined>(undefined);
  const loading = ref(false);
  const error = ref<ApiError | null>(null);

  const cities = ref<string[]>([]);
  let citiesLoaded = false;

  const pageCache = new Map<number, { items: SalesOrderToPlan[]; total: number }>();
  let cachedCity: string | undefined;

  async function load(): Promise<void> {
    if (cachedCity !== city.value) {
      pageCache.clear();
      cachedCity = city.value;
    }
    const cached = pageCache.get(page.value);
    if (cached) {
      items.value = cached.items;
      total.value = cached.total;
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      const result = await fetchSalesOrdersToPlan({ city: city.value, page: page.value, pageSize: pageSize.value });
      items.value = result.items;
      total.value = result.total;
      pageCache.set(page.value, { items: result.items, total: result.total });
    } catch (e) {
      error.value = toApiError(e);
    } finally {
      loading.value = false;
    }
  }

  async function loadCities(): Promise<void> {
    if (citiesLoaded) {
      return;
    }
    try {
      cities.value = await fetchCities();
      citiesLoaded = true;
    } catch {
    }
  }

  function setCity(value: string | undefined): void {
    city.value = value;
    page.value = 1;
    void load();
  }

  function setPage(value: number): void {
    page.value = value;
    void load();
  }

  function invalidate(): void {
    pageCache.clear();
  }

  return {
    items,
    total,
    page,
    pageSize,
    city,
    cities,
    loading,
    error,
    load,
    loadCities,
    setCity,
    setPage,
    invalidate,
  };
});
