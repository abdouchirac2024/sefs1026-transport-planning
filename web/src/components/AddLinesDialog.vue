<script setup lang="ts">
import { ref, watch } from 'vue';
import type { SalesOrderToPlan } from '../domain/types';
import { useSalesOrdersStore } from '../stores/sales-orders';
import { useTransportOrdersStore } from '../stores/transport-orders';
import AsyncState from './AsyncState.vue';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable, { type DataTablePageEvent } from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import Message from 'primevue/message';

const props = defineProps<{ visible: boolean }>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  success: [];
}>();

const salesOrdersStore = useSalesOrdersStore();
const transportOrdersStore = useTransportOrdersStore();

const selected = ref<SalesOrderToPlan[]>([]);

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      selected.value = [];
      salesOrdersStore.setPage(1);
      void salesOrdersStore.loadCities();
    }
  },
);

function onPage(event: DataTablePageEvent): void {
  salesOrdersStore.setPage(event.page + 1);
}

async function confirm(): Promise<void> {
  if (selected.value.length === 0) {
    return;
  }
  try {
    await transportOrdersStore.addLinesToCurrent(selected.value.map((so) => so.no));
    emit('success');
    emit('update:visible', false);
  } catch {
    // Erreur déjà exposée via transportOrdersStore.mutationError, affichée ci-dessous.
  }
}

function close(): void {
  emit('update:visible', false);
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="Ajouter des commandes"
    style="width: 42rem"
    @update:visible="emit('update:visible', $event)"
  >
    <AsyncState
      :loading="salesOrdersStore.loading"
      :error="salesOrdersStore.error"
      :empty="!salesOrdersStore.loading && !salesOrdersStore.error && salesOrdersStore.items.length === 0"
      empty-message="Aucune commande à planifier disponible."
      @retry="salesOrdersStore.load"
    >
      <DataTable
        :value="salesOrdersStore.items"
        v-model:selection="selected"
        data-key="no"
        lazy
        paginator
        :rows="salesOrdersStore.pageSize"
        :total-records="salesOrdersStore.total"
        :first="(salesOrdersStore.page - 1) * salesOrdersStore.pageSize"
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

    <Message v-if="transportOrdersStore.mutationError" severity="error" :closable="false">
      {{ transportOrdersStore.mutationError.message }}
    </Message>

    <template #footer>
      <Button label="Annuler" text @click="close" />
      <Button
        label="Ajouter"
        :loading="transportOrdersStore.mutating"
        :disabled="selected.length === 0"
        @click="confirm"
      />
    </template>
  </Dialog>
</template>
