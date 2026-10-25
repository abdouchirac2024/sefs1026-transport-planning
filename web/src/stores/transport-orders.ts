import { defineStore } from 'pinia';
import { ref } from 'vue';
import { toApiError, type ApiError } from '../api/http-client';
import { fetchTransportOrders } from '../api/transport-orders';
import type { TransportOrderListItem } from '../domain/types';

export const useTransportOrdersStore = defineStore('transportOrders', () => {
  const items = ref<TransportOrderListItem[]>([]);
  const total = ref(0);
  const page = ref(1);
  const pageSize = ref(20);
  const status = ref<number | undefined>(undefined);
  const date = ref<string | undefined>(undefined);
  const loading = ref(false);
  const error = ref<ApiError | null>(null);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const result = await fetchTransportOrders({
        status: status.value,
        date: date.value,
        page: page.value,
        pageSize: pageSize.value,
      });
      items.value = result.items;
      total.value = result.total;
    } catch (e) {
      error.value = toApiError(e);
    } finally {
      loading.value = false;
    }
  }

  function setStatus(value: number | undefined): void {
    status.value = value;
    page.value = 1;
    void load();
  }

  function setDate(value: string | undefined): void {
    date.value = value;
    page.value = 1;
    void load();
  }

  function setPage(value: number): void {
    page.value = value;
    void load();
  }

  return { items, total, page, pageSize, status, date, loading, error, load, setStatus, setDate, setPage };
});
