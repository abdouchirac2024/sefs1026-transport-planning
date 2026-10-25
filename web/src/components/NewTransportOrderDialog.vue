<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { toApiError, type ApiError } from '../api/http-client';
import { createTransportOrder } from '../api/transport-orders';
import { useVehiclesStore } from '../stores/vehicles';

import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Message from 'primevue/message';
import Select from 'primevue/select';

const props = defineProps<{ visible: boolean }>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  success: [transportOrderNo: string];
}>();

const vehiclesStore = useVehiclesStore();

const selectedVehicleCode = ref<string | null>(null);
const deliveryDate = ref<string>('');
const submitting = ref(false);
const submitError = ref<ApiError | null>(null);

const todayIso = new Date().toISOString().slice(0, 10);

const canSubmit = computed(
  () => selectedVehicleCode.value !== null && deliveryDate.value !== '' && !submitting.value,
);

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      selectedVehicleCode.value = null;
      deliveryDate.value = '';
      submitError.value = null;
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
    const created = await createTransportOrder({
      vehicleCode: selectedVehicleCode.value as string,
      deliveryDate: deliveryDate.value,
    });
    emit('success', created.no);
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
    header="Nouvel ordre de transport"
    style="width: 26rem"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="field">
      <label for="new-to-vehicle">Véhicule</label>
      <Select
        id="new-to-vehicle"
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
    </div>

    <div class="field">
      <label for="new-to-date">Date de livraison</label>
      <input id="new-to-date" v-model="deliveryDate" type="date" :min="todayIso" class="date-input" />
    </div>

    <Message v-if="submitError" severity="error" :closable="false">{{ submitError.message }}</Message>

    <template #footer>
      <Button label="Annuler" text @click="close" />
      <Button label="Créer" :loading="submitting" :disabled="!canSubmit" @click="handleConfirm" />
    </template>
  </Dialog>
</template>

<style scoped>
.field {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.full-width {
  width: 100%;
}

.date-input {
  padding: 0.5rem;
  width: 100%;
  box-sizing: border-box;
}
</style>
