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
  void store.load();
}

function selectedWeightKg(): number {
  return selectedOrders.value.reduce((sum, so) => sum + so.totalWeightKg, 0);
}
</script>

<template>
  <div>
    <h2>Commandes à planifier</h2>

    <div class="toolbar">
      <Select
        :model-value="store.city"
        :options="store.cities"
        placeholder="Toutes les villes"
        show-clear
        class="city-filter"
        @update:model-value="onCityChange"
      />
      <span v-if="selectedOrders.length > 0" class="selection-summary">
        {{ selectedOrders.length }} sélectionnée(s), {{ selectedWeightKg().toFixed(2) }} kg
      </span>
      <Button
        label="Ajouter à un transport"
        icon="pi pi-plus"
        :disabled="selectedOrders.length === 0"
        @click="openDialog"
      />
    </div>

    <AsyncState
      :loading="store.loading"
      :error="store.error"
      :empty="!store.loading && !store.error && store.items.length === 0"
      empty-message="Aucune commande à planifier pour le moment."
      @retry="store.load"
    >
      <DataTable
        :value="store.items"
        v-model:selection="selectedOrders"
        data-key="no"
        lazy
        paginator
        :rows="store.pageSize"
        :total-records="store.total"
        :first="(store.page - 1) * store.pageSize"
        @page="onPage"
      >
        <Column selection-mode="multiple" header-style="width: 3rem" />
        <Column field="no" header="Commande" />
        <Column field="customerName" header="Client" />
        <Column field="deliveryCity" header="Ville" />
        <Column field="totalWeightKg" header="Poids (kg)">
          <template #body="slotProps">{{ slotProps.data.totalWeightKg.toFixed(2) }}</template>
        </Column>
      </DataTable>
    </AsyncState>

    <AddToTransportDialog v-model:visible="dialogVisible" :selected-orders="selectedOrders" @success="onSuccess" />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.city-filter {
  min-width: 14rem;
}

.selection-summary {
  color: var(--p-text-muted-color);
}
</style>
