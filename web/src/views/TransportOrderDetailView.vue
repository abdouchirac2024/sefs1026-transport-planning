<script setup lang="ts">
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import AddLinesDialog from '../components/AddLinesDialog.vue';
import AsyncState from '../components/AsyncState.vue';
import CapacityGauge from '../components/CapacityGauge.vue';
import StatusTag from '../components/StatusTag.vue';
import { canDepart, canEditLines, canValidate } from '../domain/permissions';
import { useTransportOrdersStore } from '../stores/transport-orders';
import { useUserStore } from '../stores/user';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Message from 'primevue/message';

const props = defineProps<{ no: string }>();

const store = useTransportOrdersStore();
const userStore = useUserStore();
const toast = useToast();
const confirm = useConfirm();

const addLinesDialogVisible = ref(false);

onMounted(() => {
  void store.loadDetail(props.no);
});

const order = computed(() => store.current);

const showEditLines = computed(() => (order.value ? canEditLines(order.value) : false));
const showValidate = computed(() =>
  order.value ? canValidate(order.value, userStore.currentUser.role) : false,
);
const showDepart = computed(() => (order.value ? canDepart(order.value) : false));

async function removeLine(salesOrderNo: string): Promise<void> {
  try {
    await store.removeLineFromCurrent(salesOrderNo);
    toast.add({ severity: 'success', summary: 'Commande retirée', detail: salesOrderNo, life: 3000 });
  } catch {
    // Erreur déjà affichée via store.mutationError.
  }
}

function confirmValidate(): void {
  confirm.require({
    message: `Valider l'ordre ${props.no} ? Il ne sera plus modifiable ensuite.`,
    header: 'Confirmation',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Valider',
    rejectLabel: 'Annuler',
    accept: async () => {
      try {
        await store.validateCurrent();
        toast.add({ severity: 'success', summary: 'Ordre validé', detail: props.no, life: 3000 });
      } catch {
        // Erreur déjà affichée via store.mutationError.
      }
    },
  });
}

function confirmDepart(): void {
  confirm.require({
    message: `Marquer l'ordre ${props.no} comme parti ? Cette action est irréversible.`,
    header: 'Confirmation',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Marquer parti',
    rejectLabel: 'Annuler',
    accept: async () => {
      try {
        await store.departCurrent();
        toast.add({ severity: 'success', summary: 'Ordre parti', detail: props.no, life: 3000 });
      } catch {
        // Erreur déjà affichée via store.mutationError.
      }
    },
  });
}

function onLinesAdded(): void {
  toast.add({ severity: 'success', summary: 'Commandes ajoutées', life: 3000 });
}
</script>

<template>
  <div>
    <h2>Ordre {{ no }}</h2>

    <AsyncState :loading="store.detailLoading" :error="store.detailError" @retry="store.loadDetail(no)">
      <div v-if="order" class="detail">
        <section class="summary">
          <div>
            <strong>Véhicule</strong>
            <p>{{ order.vehicleCode }} ({{ order.plateNo }})</p>
          </div>
          <div>
            <strong>Date de livraison</strong>
            <p>{{ order.deliveryDate }}</p>
          </div>
          <div>
            <strong>Statut</strong>
            <p><StatusTag kind="transportOrder" :status="order.status" /></p>
          </div>
          <div>
            <strong>Créé par</strong>
            <p>{{ order.createdBy }}</p>
          </div>
          <div v-if="order.validatedBy">
            <strong>Validé par</strong>
            <p>{{ order.validatedBy }}</p>
          </div>
        </section>

        <section>
          <strong>Remplissage</strong>
          <CapacityGauge :capacity-kg="order.capacityKg" :total-weight-kg="order.totalWeightKg" />
        </section>

        <Message v-if="store.mutationError" severity="error" :closable="false">
          {{ store.mutationError.message }}
        </Message>

        <section class="actions">
          <Button
            v-if="showEditLines"
            label="Ajouter des commandes"
            icon="pi pi-plus"
            @click="addLinesDialogVisible = true"
          />
          <Button
            v-if="showValidate"
            label="Valider"
            icon="pi pi-check"
            severity="success"
            :loading="store.mutating"
            @click="confirmValidate"
          />
          <Button
            v-if="showDepart"
            label="Marquer parti"
            icon="pi pi-send"
            severity="info"
            :loading="store.mutating"
            @click="confirmDepart"
          />
        </section>

        <section>
          <strong>Commandes ({{ order.lines.length }})</strong>
          <DataTable :value="order.lines" data-key="salesOrderNo">
            <Column field="salesOrderNo" header="Commande" />
            <Column field="customerName" header="Client" />
            <Column field="deliveryCity" header="Ville" />
            <Column field="totalWeightKg" header="Poids (kg)">
              <template #body="slotProps">{{ slotProps.data.totalWeightKg.toFixed(2) }}</template>
            </Column>
            <Column v-if="showEditLines" header-style="width: 4rem">
              <template #body="slotProps">
                <Button
                  icon="pi pi-trash"
                  text
                  severity="danger"
                  :disabled="store.mutating"
                  @click="removeLine(slotProps.data.salesOrderNo)"
                />
              </template>
            </Column>
          </DataTable>
          <p v-if="order.lines.length === 0" class="empty-lines">Aucune commande dans cet ordre.</p>
        </section>
      </div>
    </AsyncState>

    <AddLinesDialog v-model:visible="addLinesDialogVisible" @success="onLinesAdded" />
  </div>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 48rem;
}

.summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 1rem;
}

.summary strong {
  display: block;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

.summary p {
  margin: 0.2rem 0 0;
}

.actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.empty-lines {
  color: var(--p-text-muted-color);
}
</style>
