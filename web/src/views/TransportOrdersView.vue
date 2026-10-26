<script setup lang="ts">
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AsyncState from '../components/AsyncState.vue';
import NewTransportOrderDialog from '../components/NewTransportOrderDialog.vue';
import StatusTag from '../components/StatusTag.vue';
import { useTransportOrdersStore } from '../stores/transport-orders';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable, { type DataTablePageEvent, type DataTableRowClickEvent } from 'primevue/datatable';
import Select from 'primevue/select';

const store = useTransportOrdersStore();
const toast = useToast();
const router = useRouter();

const dialogVisible = ref(false);

const STATUS_OPTIONS = [
  { label: 'Tous les statuts', value: undefined },
  { label: 'Brouillon', value: 0 },
  { label: 'Validé', value: 1 },
  { label: 'Parti', value: 2 },
];

onMounted(() => {
  void store.load();
});

function onPage(event: DataTablePageEvent): void {
  store.setPage(event.page + 1);
}

function onStatusChange(value: unknown): void {
  store.setStatus(typeof value === 'number' ? value : undefined);
}

function onDateChange(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  store.setDate(value === '' ? undefined : value);
}

function onRowClick(event: DataTableRowClickEvent): void {
  const no = (event.data as { no: string }).no;
  void router.push({ name: 'transport-order-detail', params: { no } });
}

function onCreated(no: string): void {
  toast.add({ severity: 'success', summary: 'Ordre créé', detail: `Ordre ${no} créé.`, life: 4000 });
  void store.load(true);
  void router.push({ name: 'transport-order-detail', params: { no } });
}
</script>

<template>
  <div>
    <h2>Ordres de transport</h2>

    <div class="toolbar">
      <Select
        :model-value="store.status"
        :options="STATUS_OPTIONS"
        option-label="label"
        option-value="value"
        class="status-filter"
        @update:model-value="onStatusChange"
      />
      <input type="date" class="date-filter" @change="onDateChange" />
      <div class="spacer" />
      <Button label="Nouvel ordre" icon="pi pi-plus" @click="dialogVisible = true" />
    </div>

    <AsyncState
      :loading="store.loading"
      :error="store.error"
      :empty="!store.loading && !store.error && store.items.length === 0"
      empty-message="Aucun ordre de transport pour ces filtres."
      @retry="() => store.load(true)"
    >
      <DataTable
        :value="store.items"
        lazy
        paginator
        :rows="store.pageSize"
        :total-records="store.total"
        :first="(store.page - 1) * store.pageSize"
        row-hover
        class="clickable-rows"
        @page="onPage"
        @row-click="onRowClick"
      >
        <Column field="no" header="Ordre" />
        <Column field="vehicleCode" header="Véhicule" />
        <Column field="deliveryDate" header="Date" />
        <Column header="Statut">
          <template #body="slotProps">
            <StatusTag kind="transportOrder" :status="slotProps.data.status" />
          </template>
        </Column>
        <Column header="Commandes">
          <template #body="slotProps">{{ slotProps.data.lineCount }}</template>
        </Column>
        <Column header="Remplissage">
          <template #body="slotProps">
            {{ slotProps.data.totalWeightKg.toFixed(2) }} / {{ slotProps.data.capacityKg.toFixed(2) }} kg
          </template>
        </Column>
      </DataTable>
    </AsyncState>

    <NewTransportOrderDialog v-model:visible="dialogVisible" @success="onCreated" />
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

.status-filter {
  min-width: 12rem;
}

.date-filter {
  padding: 0.5rem;
}

.spacer {
  flex: 1;
}

.clickable-rows :deep(.p-datatable-tbody > tr) {
  cursor: pointer;
}
</style>
