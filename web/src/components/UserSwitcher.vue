<script setup lang="ts">
import { storeToRefs } from 'pinia';
import Select from 'primevue/select';
import { useUserStore } from '../stores/user';

const userStore = useUserStore();
const { currentUserId } = storeToRefs(userStore);
// Liste statique (jamais modifiée à l'exécution) : storeToRefs() ne garde que les propriétés
// réactives (ref/computed), une constante brute comme knownUsers en serait silencieusement
// exclue (undefined après déstructuration). Accès direct, pas besoin de réactivité ici.
const knownUsers = userStore.knownUsers;

function onChange(value: unknown): void {
  if (typeof value === 'string') {
    userStore.selectUser(value);
  }
}
</script>

<template>
  <Select
    :model-value="currentUserId"
    :options="knownUsers"
    option-label="id"
    option-value="id"
    class="user-switcher"
    @update:model-value="onChange"
  >
    <template #value="slotProps">
      <span v-if="slotProps.value">
        {{ slotProps.value }} ({{ knownUsers.find((u) => u.id === slotProps.value)?.role }})
      </span>
    </template>
    <template #option="slotProps">
      <span>{{ slotProps.option.id }} ({{ slotProps.option.role }})</span>
    </template>
  </Select>
</template>
