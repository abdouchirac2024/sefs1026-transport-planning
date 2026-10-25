<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ capacityKg: number; totalWeightKg: number }>();

const percentage = computed(() => {
  if (props.capacityKg <= 0) {
    return 0;
  }
  return Math.min(100, (props.totalWeightKg / props.capacityKg) * 100);
});

// Seuils demandés : vert < 80 %, orange < 100 %, rouge = 100 % (ou au-delà, par sécurité d'affichage).
const severity = computed(() => {
  if (percentage.value >= 100) {
    return 'danger';
  }
  if (percentage.value >= 80) {
    return 'warning';
  }
  return 'success';
});
</script>

<template>
  <div class="capacity-gauge">
    <div class="capacity-gauge__bar">
      <div class="capacity-gauge__fill" :class="severity" :style="{ width: percentage + '%' }" />
    </div>
    <span class="capacity-gauge__label">
      {{ totalWeightKg.toFixed(2) }} / {{ capacityKg.toFixed(2) }} kg ({{ percentage.toFixed(0) }} %)
    </span>
  </div>
</template>

<style scoped>
.capacity-gauge {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 14rem;
}

.capacity-gauge__bar {
  height: 10px;
  border-radius: 5px;
  background: var(--p-surface-200);
  overflow: hidden;
}

.capacity-gauge__fill {
  height: 100%;
  transition: width 0.3s ease;
}

.capacity-gauge__fill.success {
  background: var(--p-green-500);
}

.capacity-gauge__fill.warning {
  background: var(--p-orange-500);
}

.capacity-gauge__fill.danger {
  background: var(--p-red-500);
}

.capacity-gauge__label {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}
</style>
