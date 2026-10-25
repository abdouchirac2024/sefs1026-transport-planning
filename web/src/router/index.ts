import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/to-plan' },
    {
      path: '/to-plan',
      name: 'sales-orders-to-plan',
      component: () => import('../views/SalesOrdersToPlanView.vue'),
    },
    {
      path: '/transport-orders',
      name: 'transport-orders',
      component: () => import('../views/TransportOrdersView.vue'),
    },
    {
      path: '/transport-orders/:no',
      name: 'transport-order-detail',
      component: () => import('../views/TransportOrderDetailView.vue'),
      props: true,
    },
  ],
});

export default router;
