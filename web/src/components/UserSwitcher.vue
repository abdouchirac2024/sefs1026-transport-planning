<script setup lang="ts">
import { storeToRefs } from 'pinia';
import Select from 'primevue/select';
import { useUserStore } from '../stores/user';

const userStore = useUserStore();
const { currentUserId, knownUsers } = storeToRefs(userStore);

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
