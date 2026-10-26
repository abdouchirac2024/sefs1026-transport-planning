import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addLines, fetchTransportOrders } from '../api/transport-orders';
import type { Page, TransportOrderDetail, TransportOrderListItem } from '../domain/types';
import { useTransportOrdersStore } from './transport-orders';

vi.mock('../api/transport-orders', () => ({
  fetchTransportOrders: vi.fn(),
  fetchTransportOrder: vi.fn(),
  createTransportOrder: vi.fn(),
  addLines: vi.fn(),
  removeLine: vi.fn(),
  validateTransportOrder: vi.fn(),
  departTransportOrder: vi.fn(),
}));

const fetchTransportOrdersMock = vi.mocked(fetchTransportOrders);
const addLinesMock = vi.mocked(addLines);

function makeOrder(no: string, status: 0 | 1 | 2 = 0): TransportOrderListItem {
  return {
    no,
    vehicleCode: 'VH-01',
    plateNo: 'CE-1234-AB',
    capacityKg: 1000,
    deliveryDate: '2026-01-01',
    status,
    createdBy: 'diane',
    validatedBy: null,
    version: '0x01',
    totalWeightKg: 100,
    lineCount: 1,
  };
}

function makePage(items: TransportOrderListItem[]): Page<TransportOrderListItem> {
  return { items, total: items.length, page: 1, pageSize: 20 };
}

function makeDetail(no: string): TransportOrderDetail {
  return { ...makeOrder(no), lines: [], remainingCapacityKg: 900 };
}

beforeEach(() => {
  setActivePinia(createPinia());
  fetchTransportOrdersMock.mockReset();
  addLinesMock.mockReset();
});

describe('useTransportOrdersStore — liste paginée', () => {
  it("ne réappelle pas l'API pour un load() répété sans rien changer", async () => {
    fetchTransportOrdersMock.mockResolvedValue(makePage([makeOrder('TO-0001')]));
    const store = useTransportOrdersStore();

    await store.load();
    await store.load();

    expect(fetchTransportOrdersMock).toHaveBeenCalledTimes(1);
  });

  it('setPage() recharge une page jamais vue puis réutilise le cache en y revenant', async () => {
    fetchTransportOrdersMock
      .mockResolvedValueOnce(makePage([makeOrder('TO-0001')]))
      .mockResolvedValueOnce(makePage([makeOrder('TO-0002')]));
    const store = useTransportOrdersStore();
    await store.load();

    store.setPage(2);
    await vi.waitFor(() => expect(fetchTransportOrdersMock).toHaveBeenCalledTimes(2));

    store.setPage(1);
    await vi.waitFor(() => expect(store.items[0].no).toBe('TO-0001'));
    expect(fetchTransportOrdersMock).toHaveBeenCalledTimes(2);
  });

  it('setStatus() vide le cache même pour une page déjà visitée', async () => {
    fetchTransportOrdersMock
      .mockResolvedValueOnce(makePage([makeOrder('TO-0001')]))
      .mockResolvedValueOnce(makePage([makeOrder('TO-0002', 1)]));
    const store = useTransportOrdersStore();
    await store.load();

    store.setStatus(1);
    await vi.waitFor(() => expect(fetchTransportOrdersMock).toHaveBeenCalledTimes(2));
    expect(fetchTransportOrdersMock).toHaveBeenLastCalledWith({
      status: 1,
      date: undefined,
      page: 1,
      pageSize: 20,
    });
  });
});

describe('useTransportOrdersStore — ordres Brouillon', () => {
  it("loadDraftOrders() n'appelle l'API qu'une seule fois", async () => {
    fetchTransportOrdersMock.mockResolvedValue(makePage([makeOrder('TO-0001')]));
    const store = useTransportOrdersStore();

    await store.loadDraftOrders();
    await store.loadDraftOrders();

    expect(fetchTransportOrdersMock).toHaveBeenCalledTimes(1);
  });
});

describe('useTransportOrdersStore — invalidation après mutation', () => {
  it('addLinesToCurrent() invalide la liste principale et les ordres Brouillon', async () => {
    fetchTransportOrdersMock.mockResolvedValue(makePage([makeOrder('TO-0001')]));
    addLinesMock.mockResolvedValue(makeDetail('TO-0001'));
    const store = useTransportOrdersStore();

    await store.load();
    await store.loadDraftOrders();
    expect(fetchTransportOrdersMock).toHaveBeenCalledTimes(2);

    store.current = makeDetail('TO-0001');
    await store.addLinesToCurrent(['SO-1']);

    await store.load();
    await store.loadDraftOrders();
    expect(fetchTransportOrdersMock).toHaveBeenCalledTimes(4);
  });

  it('reload() invalidate puis recharge immédiatement la liste', async () => {
    fetchTransportOrdersMock
      .mockResolvedValueOnce(makePage([makeOrder('TO-0001')]))
      .mockResolvedValueOnce(makePage([makeOrder('TO-0001', 1)]));
    const store = useTransportOrdersStore();
    await store.load();

    store.reload();
    await vi.waitFor(() => expect(store.items[0].status).toBe(1));
    expect(fetchTransportOrdersMock).toHaveBeenCalledTimes(2);
  });
});
