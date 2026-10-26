<script setup lang="ts">
import Button from 'primevue/button';
import ConfirmDialog from 'primevue/confirmdialog';
import Drawer from 'primevue/drawer';
import Toast from 'primevue/toast';
import { ref } from 'vue';
import AppSidebarNav from './components/AppSidebarNav.vue';
import UserSwitcher from './components/UserSwitcher.vue';

const mobileNavOpen = ref(false);
</script>

<template>
  <div class="app-shell">
    <header class="app-topbar">
      <Button
        class="app-topbar__menu-toggle"
        icon="pi pi-bars"
        text
        rounded
        aria-label="Ouvrir la navigation"
        @click="mobileNavOpen = true"
      />
      <RouterLink to="/to-plan" class="app-brand">
        <span class="app-brand__logo"><i class="pi pi-truck" /></span>
        <span class="app-brand__text">
          <strong>SEFS1026</strong>
          <small>Planification des transports</small>
        </span>
      </RouterLink>
      <div class="app-topbar__spacer" />
      <UserSwitcher />
    </header>

    <div class="app-body">
      <aside class="app-sidebar">
        <AppSidebarNav />
      </aside>

      <Drawer v-model:visible="mobileNavOpen" class="app-sidebar-drawer">
        <template #header>
          <span class="app-brand">
            <span class="app-brand__logo"><i class="pi pi-truck" /></span>
            <strong>SEFS1026</strong>
          </span>
        </template>
        <AppSidebarNav @navigate="mobileNavOpen = false" />
      </Drawer>

      <main class="app-content">
        <div class="app-content__inner">
          <RouterView />
        </div>
      </main>
    </div>

    <Toast />
    <ConfirmDialog />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--p-surface-50, #f8fafc);
}

/* --- Topbar --- */
.app-topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  height: 60px;
  padding: 0 1rem;
  background: var(--p-content-background, #fff);
  border-bottom: 1px solid var(--p-content-border-color);
}

.app-topbar__menu-toggle {
  display: none;
}

.app-brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  text-decoration: none;
  color: inherit;
}

.app-brand__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color, #fff);
  font-size: 1.1rem;
  flex-shrink: 0;
}

.app-brand__text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.app-brand__text strong {
  font-size: 0.95rem;
}

.app-brand__text small {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.app-topbar__spacer {
  flex: 1;
}

/* --- Body : sidebar + contenu --- */
.app-body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.app-sidebar {
  width: 248px;
  flex-shrink: 0;
  border-right: 1px solid var(--p-content-border-color);
  background: var(--p-content-background, #fff);
}

.app-content {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
}

.app-content__inner {
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

/* --- Responsive : sidebar devient un drawer sous 900px --- */
@media (max-width: 900px) {
  .app-topbar__menu-toggle {
    display: inline-flex;
  }

  .app-sidebar {
    display: none;
  }

  .app-content__inner {
    padding: 1rem;
  }
}

@media (max-width: 560px) {
  .app-brand__text small {
    display: none;
  }

  .app-content__inner {
    padding: 0.75rem;
  }
}
</style>
