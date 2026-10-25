<script setup lang="ts">
import Button from 'primevue/button';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import type { ApiError } from '../api/http-client';

withDefaults(
  defineProps<{
    loading: boolean;
    error: ApiError | null;
    empty?: boolean;
    emptyMessage?: string;
  }>(),
  {
    empty: false,
    emptyMessage: 'Aucun résultat.',
  },
);

const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <div class="async-state">
    <div v-if="loading" class="async-state__center">
      <ProgressSpinner style="width: 40px; height: 40px" stroke-width="4" />
    </div>
    <div v-else-if="error" class="async-state__error">
      <Message severity="error" :closable="false">{{ error.message }}</Message>
      <Button label="Réessayer" icon="pi pi-refresh" text @click="emit('retry')" />
    </div>
    <div v-else-if="empty" class="async-state__center">
      <p>{{ emptyMessage }}</p>
    </div>
    <slot v-else />
  </div>
</template>

<style scoped>
.async-state__center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: var(--p-text-muted-color);
}

.async-state__error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1.5rem 1rem;
}
</style>
