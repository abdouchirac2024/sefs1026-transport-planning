import { defineStore } from 'pinia';
import { ref } from 'vue';
import { toApiError, type ApiError } from '../api/http-client';
import {
  addLines,
  createTransportOrder,
  departTransportOrder,
  fetchTransportOrder,
  fetchTransportOrders,
  removeLine,
  validateTransportOrder,
} from '../api/transport-orders';
import type { TransportOrderDetail, TransportOrderListItem } from '../domain/types';

export const useTransportOrdersStore = defineStore('transportOrders', () => {
  // --- Liste ---
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

  // --- Détail + mutations ---
  const current = ref<TransportOrderDetail | null>(null);
  const detailLoading = ref(false);
  const detailError = ref<ApiError | null>(null);
  const mutating = ref(false);
  const mutationError = ref<ApiError | null>(null);

  async function loadDetail(no: string): Promise<void> {
    detailLoading.value = true;
    detailError.value = null;
    current.value = null;
    try {
      current.value = await fetchTransportOrder(no);
    } catch (e) {
      detailError.value = toApiError(e);
    } finally {
      detailLoading.value = false;
    }
  }

  /** Enveloppe commune aux mutations sur `current` : état mutating/mutationError, remplace `current` par la réponse. */
  async function runMutation(action: () => Promise<TransportOrderDetail>): Promise<void> {
    mutating.value = true;
    mutationError.value = null;
    try {
      current.value = await action();
    } catch (e) {
      mutationError.value = toApiError(e);
      throw e;
    } finally {
      mutating.value = false;
    }
  }

  async function create(input: { vehicleCode: string; deliveryDate: string }): Promise<TransportOrderDetail> {
    const created = await createTransportOrder(input);
    current.value = created;
    return created;
  }

  async function addLinesToCurrent(salesOrderNos: string[]): Promise<void> {
    if (!current.value) {
      return;
    }
    const { no, version } = current.value;
    await runMutation(() => addLines(no, salesOrderNos, version));
  }

  async function removeLineFromCurrent(salesOrderNo: string): Promise<void> {
    if (!current.value) {
      return;
    }
    const { no, version } = current.value;
    await runMutation(() => removeLine(no, salesOrderNo, version));
  }

  async function validateCurrent(): Promise<void> {
    if (!current.value) {
      return;
    }
    const { no, version } = current.value;
    await runMutation(() => validateTransportOrder(no, version));
  }

  async function departCurrent(): Promise<void> {
    if (!current.value) {
      return;
    }
    const { no, version } = current.value;
    await runMutation(() => departTransportOrder(no, version));
  }

  return {
    items,
    total,
    page,
    pageSize,
    status,
    date,
    loading,
    error,
    load,
    setStatus,
    setDate,
    setPage,
    current,
    detailLoading,
    detailError,
    mutating,
    mutationError,
    loadDetail,
    create,
    addLinesToCurrent,
    removeLineFromCurrent,
    validateCurrent,
    departCurrent,
  };
});
