<script setup lang="ts">
import Tag from 'primevue/tag';
import { computed } from 'vue';

const props = defineProps<{
  kind: 'salesOrder' | 'transportOrder';
  status: number;
}>();

const SALES_ORDER_LABELS: Record<number, string> = {
  0: 'À planifier',
  1: 'Planifiée',
  2: 'En livraison',
};
const TRANSPORT_ORDER_LABELS: Record<number, string> = {
  0: 'Brouillon',
  1: 'Validé',
  2: 'Parti',
};
const SALES_ORDER_SEVERITIES: Record<number, string> = {
  0: 'warn',
  1: 'info',
  2: 'success',
};
const TRANSPORT_ORDER_SEVERITIES: Record<number, string> = {
  0: 'secondary',
  1: 'info',
  2: 'success',
};

const label = computed(
  () => (props.kind === 'salesOrder' ? SALES_ORDER_LABELS : TRANSPORT_ORDER_LABELS)[props.status] ?? '?',
);
const severity = computed(
  () => (props.kind === 'salesOrder' ? SALES_ORDER_SEVERITIES : TRANSPORT_ORDER_SEVERITIES)[props.status] ?? 'secondary',
);
</script>

<template>
  <Tag :value="label" :severity="severity" />
</template>
