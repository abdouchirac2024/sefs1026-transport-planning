<script setup lang="ts">
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';
import AddToTransportDialog from '../components/AddToTransportDialog.vue';
import AsyncState from '../components/AsyncState.vue';
import type { SalesOrderToPlan } from '../domain/types';
import { useSalesOrdersStore } from '../stores/sales-orders';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable, { type DataTablePageEvent } from 'primevue/datatable';
import Select from 'primevue/select';
import Tag from 'primevue/tag';

const store = useSalesOrdersStore();
const toast = useToast();

const selectedOrders = ref<SalesOrderToPlan[]>([]);
const dialogVisible = ref(false);

onMounted(() => {
  void store.load();
  void store.loadCities();
});

function onPage(event: DataTablePageEvent): void {
  store.setPage(event.page + 1);
}

function onCityChange(value: unknown): void {
  store.setCity(typeof value === 'string' && value !== '' ? value : undefined);
  selectedOrders.value = [];
}

function openDialog(): void {
  dialogVisible.value = true;
}

function onSuccess(transportOrderNo: string): void {
  toast.add({
    severity: 'success',
    summary: 'Commandes ajoutées',
    detail: `Ajoutées à l'ordre ${transportOrderNo}.`,
    life: 4000,
  });
  selectedOrders.value = [];
  void store.load(true);
}

function selectedWeightKg(): number {
  return selectedOrders.value.reduce((sum, so) => sum + so.totalWeightKg, 0);
}
</script>

<template>
  <div class="to-plan">
    <header class="page-header">
      <div class="page-header__icon"><i class="pi pi-inbox" /></div>
      <div>
        <h2>Commandes à planifier</h2>
        <p>Sélectionnez une ou plusieurs commandes à regrouper dans un ordre de transport.</p>
      </div>
    </header>

    <section class="toolbar-card">
      <div class="city-filter">
        <label class="city-filter__label"><i class="pi pi-map-marker" /> Ville</label>
        <Select
          :model-value="store.city"
          :options="store.cities"
          placeholder="Toutes les villes"
          show-clear
          class="city-filter__select"
          @update:model-value="onCityChange"
        />
      </div>

      <div class="toolbar-card__spacer" />

      <Tag v-if="selectedOrders.length > 0" severity="info" class="selection-tag">
        <i class="pi pi-check-circle" />
        {{ selectedOrders.length }} sélectionnée(s) — {{ selectedWeightKg().toFixed(2) }} kg
      </Tag>

      <Button
        label="Ajouter à un transport"
        icon="pi pi-plus"
        :disabled="selectedOrders.length === 0"
        class="toolbar-card__action"
        @click="openDialog"
      />
    </section>

    <AsyncState
      :loading="store.loading"
      :error="store.error"
      :empty="!store.loading && !store.error && store.items.length === 0"
      empty-message="Aucune commande à planifier pour le moment."
      @retry="() => store.load(true)"
    >
      <section class="table-card">
        <div class="table-scroll">
          <DataTable
            :value="store.items"
            v-model:selection="selectedOrders"
            data-key="no"
            lazy
            paginator
            striped-rows
            :rows="store.pageSize"
            :total-records="store.total"
            :first="(store.page - 1) * store.pageSize"
            class="to-plan-table"
            @page="onPage"
          >
            <Column selection-mode="multiple" header-style="width: 3rem" />
            <Column field="no" header="Commande">
              <template #body="slotProps">
                <span class="order-no">{{ slotProps.data.no }}</span>
              </template>
            </Column>
            <Column field="customerName" header="Client" />
            <Column field="deliveryCity" header="Ville">
              <template #body="slotProps">
                <span class="city-cell"><i class="pi pi-map-marker" />{{ slotProps.data.deliveryCity }}</span>
              </template>
            </Column>
            <Column field="totalWeightKg" header="Poids (kg)" header-style="text-align: right">
              <template #body="slotProps">
                <span class="weight-cell">{{ slotProps.data.totalWeightKg.toFixed(2) }}</span>
              </template>
            </Column>
          </DataTable>
        </div>
      </section>
    </AsyncState>

    <AddToTransportDialog v-model:visible="dialogVisible" :selected-orders="selectedOrders" @success="onSuccess" />
  </div>
</template>

<style scoped>
.to-plan {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* --- En-tête de page --- */
.page-header {
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
}

.page-header__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--p-primary-100, var(--p-highlight-background));
  color: var(--p-primary-color);
  font-size: 1.25rem;
  flex-shrink: 0;
}

.page-header h2 {
  margin: 0 0 0.2rem;
  font-size: 1.4rem;
}

.page-header p {
  margin: 0;
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
}

/* --- Barre d'outils --- */
.toolbar-card {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  flex-wrap: wrap;
  padding: 1rem 1.25rem;
  background: var(--p-content-background, #fff);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
}

.city-filter {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 16rem;
}

.city-filter__label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.city-filter__select {
  width: 100%;
}

.toolbar-card__spacer {
  flex: 1;
  min-width: 0;
}

.selection-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
}

.toolbar-card__action {
  white-space: nowrap;
}

/* --- Tableau --- */
.table-card {
  background: var(--p-content-background, #fff);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  overflow: hidden;
}

.table-scroll {
  overflow-x: auto;
}

.to-plan-table {
  min-width: 42rem;
}

.order-no {
  font-weight: 600;
  color: var(--p-primary-color);
}

.city-cell {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--p-text-muted-color);
}

.city-cell i {
  font-size: 0.8rem;
}

.weight-cell {
  display: block;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* --- Responsive --- */
@media (max-width: 640px) {
  .toolbar-card {
    flex-direction: column;
    align-items: stretch;
  }

  .city-filter {
    min-width: 0;
  }

  .toolbar-card__spacer {
    display: none;
  }

  .toolbar-card__action {
    width: 100%;
  }

  .page-header__icon {
    width: 38px;
    height: 38px;
    font-size: 1.1rem;
  }

  .page-header h2 {
    font-size: 1.2rem;
  }
}
</style>
