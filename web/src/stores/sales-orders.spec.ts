import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCities, fetchSalesOrdersToPlan } from '../api/sales-orders';
import type { Page, SalesOrderToPlan } from '../domain/types';
import { useSalesOrdersStore } from './sales-orders';

vi.mock('../api/sales-orders', () => ({
  fetchSalesOrdersToPlan: vi.fn(),
  fetchCities: vi.fn(),
}));

const fetchSalesOrdersToPlanMock = vi.mocked(fetchSalesOrdersToPlan);
const fetchCitiesMock = vi.mocked(fetchCities);

function makeOrder(no: string, totalWeightKg = 10): SalesOrderToPlan {
  return { no, customerNo: 'C1', customerName: 'Client', deliveryCity: 'Douala', totalWeightKg, status: 0 };
}

function makePage(items: SalesOrderToPlan[]): Page<SalesOrderToPlan> {
  return { items, total: items.length, page: 1, pageSize: 20 };
}

beforeEach(() => {
  setActivePinia(createPinia());
  fetchSalesOrdersToPlanMock.mockReset();
  fetchCitiesMock.mockReset();
});

describe('useSalesOrdersStore', () => {
  it("ne réappelle pas l'API pour un load() répété sans rien changer", async () => {
    fetchSalesOrdersToPlanMock.mockResolvedValue(makePage([makeOrder('SO-1')]));
    const store = useSalesOrdersStore();

    await store.load();
    await store.load();

    expect(fetchSalesOrdersToPlanMock).toHaveBeenCalledTimes(1);
    expect(store.items).toHaveLength(1);
  });

  it('setPage() recharge une page jamais vue puis réutilise le cache en y revenant', async () => {
    fetchSalesOrdersToPlanMock
      .mockResolvedValueOnce(makePage([makeOrder('SO-1')]))
      .mockResolvedValueOnce(makePage([makeOrder('SO-2')]));
    const store = useSalesOrdersStore();
    await store.load();

    store.setPage(2);
    await vi.waitFor(() => expect(fetchSalesOrdersToPlanMock).toHaveBeenCalledTimes(2));
    expect(store.items[0].no).toBe('SO-2');

    store.setPage(1);
    await vi.waitFor(() => expect(store.items[0].no).toBe('SO-1'));
    expect(fetchSalesOrdersToPlanMock).toHaveBeenCalledTimes(2);
  });

  it('setCity() vide le cache : la page 1 est rechargée même si elle était déjà en cache', async () => {
    fetchSalesOrdersToPlanMock
      .mockResolvedValueOnce(makePage([makeOrder('SO-1')]))
      .mockResolvedValueOnce(makePage([makeOrder('SO-2')]));
    const store = useSalesOrdersStore();
    await store.load();

    store.setCity('Kribi');
    await vi.waitFor(() => expect(fetchSalesOrdersToPlanMock).toHaveBeenCalledTimes(2));
    expect(fetchSalesOrdersToPlanMock).toHaveBeenLastCalledWith({ city: 'Kribi', page: 1, pageSize: 20 });
  });

  it('invalidate() force un rechargement au prochain load()', async () => {
    fetchSalesOrdersToPlanMock
      .mockResolvedValueOnce(makePage([makeOrder('SO-1')]))
      .mockResolvedValueOnce(makePage([makeOrder('SO-1-updated', 99)]));
    const store = useSalesOrdersStore();
    await store.load();

    store.invalidate();
    await store.load();
    await store.load();

    expect(fetchSalesOrdersToPlanMock).toHaveBeenCalledTimes(2);
    expect(store.items[0].totalWeightKg).toBe(99);
  });

  it('reload() invalidate puis recharge immédiatement', async () => {
    fetchSalesOrdersToPlanMock
      .mockResolvedValueOnce(makePage([makeOrder('SO-1')]))
      .mockResolvedValueOnce(makePage([makeOrder('SO-1-updated', 99)]));
    const store = useSalesOrdersStore();
    await store.load();

    store.reload();
    await vi.waitFor(() => expect(store.items[0].totalWeightKg).toBe(99));
    expect(fetchSalesOrdersToPlanMock).toHaveBeenCalledTimes(2);
  });

  it("loadCities() n'appelle l'API qu'une seule fois", async () => {
    fetchCitiesMock.mockResolvedValue(['Douala', 'Yaoundé']);
    const store = useSalesOrdersStore();

    await store.loadCities();
    await store.loadCities();

    expect(fetchCitiesMock).toHaveBeenCalledTimes(1);
    expect(store.cities).toEqual(['Douala', 'Yaoundé']);
  });

  it('expose une erreur exploitable quand le chargement échoue, sans marquer la page comme mise en cache', async () => {
    fetchSalesOrdersToPlanMock
      .mockRejectedValueOnce(new Error('réseau indisponible'))
      .mockResolvedValueOnce(makePage([makeOrder('SO-1')]));
    const store = useSalesOrdersStore();

    await store.load();
    expect(store.error).not.toBeNull();

    await store.load();
    expect(fetchSalesOrdersToPlanMock).toHaveBeenCalledTimes(2);
    expect(store.items).toHaveLength(1);
  });
});
