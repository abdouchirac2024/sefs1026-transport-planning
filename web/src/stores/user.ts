import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { setCurrentUserId } from '../api/http-client';
import type { Role } from '../domain/types';

export interface KnownUser {
  id: string;
  role: Role;
}

/** Codés en dur côté API (voir auth/users.ts) : pas d'authentification réelle demandée par le sujet. */
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
    // localStorage indisponible (navigation privée, etc.) : on retombe sur le défaut.
  }
  return KNOWN_USERS[0].id;
}

export const useUserStore = defineStore('user', () => {
  const currentUserId = ref(loadPersistedUserId());
  const currentUser = computed(
    () => KNOWN_USERS.find((user) => user.id === currentUserId.value) ?? KNOWN_USERS[0],
  );

  // immediate: true pousse l'utilisateur courant vers le client HTTP dès la création du store
  // (y compris au chargement initial de la page, pas seulement sur un changement explicite).
  watch(
    currentUserId,
    (id) => {
      setCurrentUserId(id);
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {
        // pas bloquant : juste pas de persistance entre sessions.
      }
    },
    { immediate: true },
  );

  function selectUser(id: string): void {
    currentUserId.value = id;
  }

  return { currentUserId, currentUser, knownUsers: KNOWN_USERS, selectUser };
});
