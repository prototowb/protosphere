import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/LoginPage.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/pages/RegisterPage.vue'),
    },
    {
      path: '/channels/@me',
      name: 'dms',
      component: () => import('@/pages/DMPage.vue'),
    },
    {
      path: '/channels/@me/:dmGroupId',
      name: 'dm-conversation',
      component: () => import('@/pages/DMPage.vue'),
    },
    {
      path: '/channels/:serverId/:channelId',
      name: 'server-channel',
      component: () => import('@/pages/ServerPage.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/pages/SettingsPage.vue'),
    },
    {
      path: '/settings/profile',
      name: 'settings-profile',
      component: () => import('@/pages/SettingsPage.vue'),
    },
    {
      path: '/servers/:serverId/settings',
      name: 'server-settings',
      component: () => import('@/pages/ServerSettingsPage.vue'),
    },
    {
      path: '/invite/:code',
      name: 'invite',
      component: () => import('@/pages/InvitePage.vue'),
    },
    {
      path: '/',
      redirect: '/channels/@me',
    },
  ],
})

export default router
