<script setup lang="ts">
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
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
const router = useRouter();

const addLinesDialogVisible = ref(false);

function goToList(): void {
  void router.push({ name: 'transport-orders' });
}

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
  }
}

function confirmMutation(
  action: () => Promise<void>,
  options: { message: string; acceptLabel: string; successSummary: string },
): void {
  confirm.require({
    message: options.message,
    header: 'Confirmation',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: options.acceptLabel,
    rejectLabel: 'Annuler',
    accept: async () => {
      try {
        await action();
        toast.add({ severity: 'success', summary: options.successSummary, detail: props.no, life: 3000 });
      } catch {
      }
    },
  });
}

function confirmValidate(): void {
  confirmMutation(() => store.validateCurrent(), {
    message: `Valider l'ordre ${props.no} ? Il ne sera plus modifiable ensuite.`,
    acceptLabel: 'Valider',
    successSummary: 'Ordre validé',
  });
}

function confirmDepart(): void {
  confirmMutation(() => store.departCurrent(), {
    message: `Marquer l'ordre ${props.no} comme parti ? Cette action est irréversible.`,
    acceptLabel: 'Marquer parti',
    successSummary: 'Ordre parti',
  });
}

function onLinesAdded(): void {
  toast.add({ severity: 'success', summary: 'Commandes ajoutées', life: 3000 });
}
</script>

<template>
  <div class="order-detail">
    <header class="page-header">
      <Button
        icon="pi pi-arrow-left"
        text
        rounded
        aria-label="Retour aux ordres de transport"
        class="page-header__back"
        @click="goToList"
      />
      <div class="page-header__icon"><i class="pi pi-file" /></div>
      <div>
        <h2>Ordre {{ no }}</h2>
        <p>Véhicule, commandes et actions disponibles selon le statut et votre rôle.</p>
      </div>
    </header>

    <AsyncState :loading="store.detailLoading" :error="store.detailError" @retry="store.loadDetail(no)">
      <div v-if="order" class="detail">
        <section class="info-card">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-item__label"><i class="pi pi-truck" /> Véhicule</span>
              <span class="info-item__value">{{ order.vehicleCode }} ({{ order.plateNo }})</span>
            </div>
            <div class="info-item">
              <span class="info-item__label"><i class="pi pi-calendar" /> Date de livraison</span>
              <span class="info-item__value">{{ order.deliveryDate }}</span>
            </div>
            <div class="info-item">
              <span class="info-item__label"><i class="pi pi-flag" /> Statut</span>
              <StatusTag kind="transportOrder" :status="order.status" />
            </div>
            <div class="info-item">
              <span class="info-item__label"><i class="pi pi-user" /> Créé par</span>
              <span class="info-item__value">{{ order.createdBy }}</span>
            </div>
            <div v-if="order.validatedBy" class="info-item">
              <span class="info-item__label"><i class="pi pi-verified" /> Validé par</span>
              <span class="info-item__value">{{ order.validatedBy }}</span>
            </div>
          </div>

          <div class="gauge-block">
            <span class="gauge-block__label">Remplissage</span>
            <CapacityGauge :capacity-kg="order.capacityKg" :total-weight-kg="order.totalWeightKg" />
          </div>

          <Message v-if="store.mutationError" severity="error" :closable="false">
            {{ store.mutationError.message }}
          </Message>

          <div class="actions">
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
          </div>
        </section>

        <section class="table-card">
          <h3 class="table-card__title">Commandes ({{ order.lines.length }})</h3>
          <div class="table-scroll">
            <DataTable :value="order.lines" data-key="salesOrderNo" striped-rows class="lines-table">
              <Column field="salesOrderNo" header="Commande">
                <template #body="slotProps">
                  <span class="order-no">{{ slotProps.data.salesOrderNo }}</span>
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
              <Column v-if="showEditLines" header-style="width: 4rem">
                <template #body="slotProps">
                  <Button
                    icon="pi pi-trash"
                    text
                    rounded
                    severity="danger"
                    :disabled="store.mutating"
                    @click="removeLine(slotProps.data.salesOrderNo)"
                  />
                </template>
              </Column>
            </DataTable>
          </div>
          <p v-if="order.lines.length === 0" class="empty-lines">Aucune commande dans cet ordre.</p>
        </section>
      </div>
    </AsyncState>

    <AddLinesDialog v-model:visible="addLinesDialogVisible" @success="onLinesAdded" />
  </div>
</template>

<style scoped>
.order-detail {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.page-header {
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
}

.page-header__back {
  flex-shrink: 0;
  margin-top: 2px;
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

.detail {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.info-card {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.25rem;
  background: var(--p-content-background, #fff);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 1rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.info-item__label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.info-item__value {
  font-size: 0.95rem;
}

.gauge-block {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.gauge-block__label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.table-card {
  padding: 1.25rem;
  background: var(--p-content-background, #fff);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
}

.table-card__title {
  margin: 0 0 1rem;
  font-size: 1.05rem;
}

.table-scroll {
  overflow-x: auto;
  border-radius: 8px;
}

.lines-table {
  min-width: 32rem;
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

.empty-lines {
  margin: 1rem 0 0;
  color: var(--p-text-muted-color);
}

@media (max-width: 640px) {
  .page-header__icon {
    width: 38px;
    height: 38px;
    font-size: 1.1rem;
  }

  .page-header h2 {
    font-size: 1.2rem;
  }

  .info-card,
  .table-card {
    padding: 1rem;
  }

  .actions {
    flex-direction: column;
    align-items: stretch;
  }

  .actions :deep(.p-button) {
    width: 100%;
  }
}
</style>
