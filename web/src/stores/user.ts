import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { setCurrentUserId } from '../api/http-client';
import type { Role } from '../domain/types';

export interface KnownUser {
  id: string;
  role: Role;
}

export const KNOWN_USERS: KnownUser[] = [
  { id: 'diane', role: 'DISPATCHER' },
  { id: 'eric', role: 'LOGISTICS_MANAGER' },
];

const STORAGE_KEY = 'sefs1026:currentUserId';

function loadPersistedUserId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && KNOWN_USERS.some((user) => user.id === stored)) {
      return stored;
    }
  } catch {
  }
  return KNOWN_USERS[0].id;
}

export const useUserStore = defineStore('user', () => {
  const currentUserId = ref(loadPersistedUserId());
  const currentUser = computed(
    () => KNOWN_USERS.find((user) => user.id === currentUserId.value) ?? KNOWN_USERS[0],
  );

  watch(
    currentUserId,
    (id) => {
      setCurrentUserId(id);
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {
      }
    },
    { immediate: true },
  );

  function selectUser(id: string): void {
    currentUserId.value = id;
  }

  return { currentUserId, currentUser, knownUsers: KNOWN_USERS, selectUser };
});
