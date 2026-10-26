<script setup lang="ts">
const emit = defineEmits<{ navigate: [] }>();

const links = [
  { to: '/to-plan', label: 'Commandes à planifier', icon: 'pi pi-inbox' },
  { to: '/transport-orders', label: 'Ordres de transport', icon: 'pi pi-truck' },
];
</script>

<template>
  <nav class="sidebar-nav" aria-label="Navigation principale">
    <RouterLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      class="sidebar-nav__link"
      @click="emit('navigate')"
    >
      <i :class="link.icon" />
      <span>{{ link.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem;
}

.sidebar-nav__link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  color: var(--p-text-color);
  text-decoration: none;
  font-size: 0.925rem;
  font-weight: 500;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.sidebar-nav__link i {
  font-size: 1.05rem;
  color: var(--p-text-muted-color);
  transition: color 0.15s ease;
}

.sidebar-nav__link:hover {
  background: var(--p-content-hover-background);
}

.sidebar-nav__link.router-link-active {
  background: var(--p-primary-100, var(--p-highlight-background));
  color: var(--p-primary-700, var(--p-primary-color));
}

.sidebar-nav__link.router-link-active i {
  color: var(--p-primary-color);
}
</style>
