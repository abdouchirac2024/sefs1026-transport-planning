<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { toApiError, type ApiError } from '../api/http-client';
import { addLines, createTransportOrder, fetchTransportOrders } from '../api/transport-orders';
import type { SalesOrderToPlan, TransportOrderListItem } from '../domain/types';
import { useTransportOrdersStore } from '../stores/transport-orders';
import { useVehiclesStore } from '../stores/vehicles';

import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import RadioButton from 'primevue/radiobutton';
import Select from 'primevue/select';

const props = defineProps<{
  visible: boolean;
  selectedOrders: SalesOrderToPlan[];
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  success: [transportOrderNo: string];
}>();

const vehiclesStore = useVehiclesStore();
const transportOrdersStore = useTransportOrdersStore();

type Mode = 'existing' | 'new';
const mode = ref<Mode>('existing');

const draftOrders = ref<TransportOrderListItem[]>([]);
const draftOrdersLoading = ref(false);
const draftOrdersError = ref<ApiError | null>(null);

const selectedDraftNo = ref<string | null>(null);
const selectedVehicleCode = ref<string | null>(null);
const deliveryDate = ref<string>('');

const submitting = ref(false);
const submitError = ref<ApiError | null>(null);

const todayIso = new Date().toISOString().slice(0, 10);

const selectedWeightKg = computed(() => props.selectedOrders.reduce((sum, so) => sum + so.totalWeightKg, 0));

const selectedDraft = computed(() => draftOrders.value.find((d) => d.no === selectedDraftNo.value) ?? null);

const remainingCapacityKg = computed(() => {
  if (mode.value === 'existing' && selectedDraft.value) {
    return selectedDraft.value.capacityKg - selectedDraft.value.totalWeightKg;
  }
  if (mode.value === 'new' && selectedVehicleCode.value) {
    const vehicle = vehiclesStore.vehicles.find((v) => v.code === selectedVehicleCode.value);
    return vehicle?.capacityKg ?? null;
  }
  return null;
});

const wouldExceedCapacity = computed(
  () => remainingCapacityKg.value !== null && selectedWeightKg.value > remainingCapacityKg.value,
);

/** Pourcentage de la capacité restante que la sélection consommerait, plafonné à 100 pour l'affichage de la barre. */
const capacityPreviewPercent = computed(() => {
  if (!remainingCapacityKg.value || remainingCapacityKg.value <= 0) {
    return selectedWeightKg.value > 0 ? 100 : 0;
  }
  return Math.min(100, (selectedWeightKg.value / remainingCapacityKg.value) * 100);
});

const overflowKg = computed(() =>
  remainingCapacityKg.value !== null ? selectedWeightKg.value - remainingCapacityKg.value : 0,
);

const canSubmit = computed(() => {
  if (props.selectedOrders.length === 0 || submitting.value) {
    return false;
  }
  if (mode.value === 'existing') {
    return selectedDraftNo.value !== null;
  }
  return selectedVehicleCode.value !== null && deliveryDate.value !== '';
});

async function loadDraftOrders(): Promise<void> {
  draftOrdersLoading.value = true;
  draftOrdersError.value = null;
  try {
    const result = await fetchTransportOrders({ status: 0, page: 1, pageSize: 100 });
    draftOrders.value = result.items;
  } catch (e) {
    draftOrdersError.value = toApiError(e);
  } finally {
    draftOrdersLoading.value = false;
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      mode.value = 'existing';
      selectedDraftNo.value = null;
      selectedVehicleCode.value = null;
      deliveryDate.value = '';
      submitError.value = null;
      void loadDraftOrders();
      void vehiclesStore.load();
    }
  },
);

async function handleConfirm(): Promise<void> {
  if (!canSubmit.value) {
    return;
  }
  submitting.value = true;
  submitError.value = null;
  try {
    let no: string;
    let version: string | undefined;

    if (mode.value === 'existing') {
      no = selectedDraftNo.value as string;
      version = selectedDraft.value?.version;
    } else {
      const created = await createTransportOrder({
        vehicleCode: selectedVehicleCode.value as string,
        deliveryDate: deliveryDate.value,
      });
      no = created.no;
      version = created.version;
    }

    const salesOrderNos = props.selectedOrders.map((so) => so.no);
    await addLines(no, salesOrderNos, version);
    transportOrdersStore.invalidate();

    emit('success', no);
    emit('update:visible', false);
  } catch (e) {
    submitError.value = toApiError(e);
  } finally {
    submitting.value = false;
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
    header="Ajouter à un transport"
    style="width: 32rem"
    @update:visible="emit('update:visible', $event)"
  >
    <p>{{ selectedOrders.length }} commande(s) sélectionnée(s), {{ selectedWeightKg.toFixed(2) }} kg au total.</p>

    <div class="mode-choice">
      <label><RadioButton v-model="mode" value="existing" name="mode" /> Ordre Brouillon existant</label>
      <label><RadioButton v-model="mode" value="new" name="mode" /> Nouvel ordre</label>
    </div>

    <div v-if="mode === 'existing'" class="mode-panel">
      <div v-if="draftOrdersLoading" class="center"><ProgressSpinner style="width: 24px; height: 24px" /></div>
      <Message v-else-if="draftOrdersError" severity="error" :closable="false">{{ draftOrdersError.message }}</Message>
      <p v-else-if="draftOrders.length === 0">Aucun ordre Brouillon disponible. Créez-en un nouveau.</p>
      <Select
        v-else
        v-model="selectedDraftNo"
        :options="draftOrders"
        option-label="no"
        option-value="no"
        placeholder="Choisir un ordre"
        class="full-width"
      >
        <template #option="slotProps">
          {{ slotProps.option.no }} — {{ slotProps.option.vehicleCode }} ({{
            (slotProps.option.capacityKg - slotProps.option.totalWeightKg).toFixed(2)
          }}
          kg restants)
        </template>
      </Select>
    </div>

    <div v-else class="mode-panel">
      <Select
        v-model="selectedVehicleCode"
        :options="vehiclesStore.vehicles"
        option-label="code"
        option-value="code"
        placeholder="Choisir un véhicule"
        class="full-width"
      >
        <template #option="slotProps">
          {{ slotProps.option.code }} ({{ slotProps.option.plateNo }}, {{ slotProps.option.capacityKg }} kg)
        </template>
      </Select>
      <input v-model="deliveryDate" type="date" :min="todayIso" class="date-input" />
    </div>

    <div v-if="remainingCapacityKg !== null" class="capacity-preview" :class="{ 'capacity-preview--danger': wouldExceedCapacity }">
      <div class="capacity-preview__row">
        <span class="capacity-preview__label">
          <i class="pi" :class="wouldExceedCapacity ? 'pi-exclamation-triangle' : 'pi-check-circle'" />
          {{ wouldExceedCapacity ? 'Capacité insuffisante' : 'Tient dans la capacité restante' }}
        </span>
        <span class="capacity-preview__values">
          {{ selectedWeightKg.toFixed(2) }} / {{ remainingCapacityKg.toFixed(2) }} kg
        </span>
      </div>
      <div class="capacity-preview__bar">
        <div class="capacity-preview__fill" :style="{ width: capacityPreviewPercent + '%' }" />
      </div>
      <p v-if="wouldExceedCapacity" class="capacity-preview__hint">
        Dépasse la capacité restante de <strong>{{ overflowKg.toFixed(2) }} kg</strong> — réduisez la sélection ou
        choisissez un véhicule avec plus de capacité disponible.
      </p>
    </div>

    <Message v-if="submitError" severity="error" :closable="false">{{ submitError.message }}</Message>

    <template #footer>
      <Button label="Annuler" text @click="close" />
      <Button label="Ajouter" :loading="submitting" :disabled="!canSubmit" @click="handleConfirm" />
    </template>
  </Dialog>
</template>

<style scoped>
.mode-choice {
  display: flex;
  gap: 1.5rem;
  margin: 1rem 0;
}

.mode-choice label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.mode-panel {
  margin-bottom: 1rem;
}

.full-width {
  width: 100%;
}

.date-input {
  margin-top: 0.75rem;
  padding: 0.5rem;
  width: 100%;
  box-sizing: border-box;
}

.center {
  display: flex;
  justify-content: center;
  padding: 1rem;
}

.capacity-preview {
  margin: 1rem 0;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  background: var(--p-green-50, #f0fdf4);
  border: 1px solid var(--p-green-200, #bbf7d0);
}

.capacity-preview--danger {
  background: var(--p-red-50, #fef2f2);
  border-color: var(--p-red-200, #fecaca);
}

.capacity-preview__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.capacity-preview__label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
  font-size: 0.88rem;
  color: var(--p-green-700, #15803d);
}

.capacity-preview--danger .capacity-preview__label {
  color: var(--p-red-700, #b91c1c);
}

.capacity-preview__values {
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  color: var(--p-text-muted-color);
}

.capacity-preview__bar {
  height: 8px;
  border-radius: 4px;
  background: var(--p-surface-200, #e5e7eb);
  overflow: hidden;
}

.capacity-preview__fill {
  height: 100%;
  border-radius: 4px;
  background: var(--p-green-500, #22c55e);
  transition: width 0.25s ease;
}

.capacity-preview--danger .capacity-preview__fill {
  background: var(--p-red-500, #ef4444);
}

.capacity-preview__hint {
  margin: 0.6rem 0 0;
  font-size: 0.82rem;
  color: var(--p-red-700, #b91c1c);
}
</style>
