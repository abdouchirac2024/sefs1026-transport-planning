<script setup lang="ts">
import ConfirmDialog from 'primevue/confirmdialog';
import Toast from 'primevue/toast';
import UserSwitcher from './components/UserSwitcher.vue';
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <h1>SEFS1026 — Planification des transports</h1>
      <nav class="app-nav">
        <RouterLink to="/to-plan">Commandes à planifier</RouterLink>
        <RouterLink to="/transport-orders">Ordres de transport</RouterLink>
      </nav>
      <UserSwitcher />
    </header>
    <main class="app-content">
      <RouterView />
    </main>
    <Toast />
    <ConfirmDialog />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid var(--p-content-border-color);
  flex-wrap: wrap;
}

.app-header h1 {
  font-size: 1.1rem;
  margin: 0;
  white-space: nowrap;
}

.app-nav {
  display: flex;
  gap: 1rem;
  flex: 1;
}

.app-nav a {
  text-decoration: none;
  color: inherit;
  font-weight: 500;
}

.app-nav a.router-link-active {
  color: var(--p-primary-color);
}

.app-content {
  flex: 1;
  padding: 1.5rem;
}
</style>
