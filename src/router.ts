import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const publicRoutes = ['login', 'register', 'landing']

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: () => import('@/pages/LandingPage.vue'),
    },
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
      alias: '/spaces/:serverId/:channelId',
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
      path: '/admin/community',
      name: 'community-settings',
      component: () => import('@/pages/CommunitySettingsPage.vue'),
    },
    {
      path: '/admin/modqueue',
      name: 'mod-queue',
      component: () => import('@/pages/ModQueuePage.vue'),
    },
    {
      path: '/invite/:code',
      name: 'invite',
      component: () => import('@/pages/InvitePage.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      redirect: '/channels/@me',
    },
  ],
})

router.beforeEach((to) => {
  const authStore = useAuthStore()

  // While loading auth state, allow navigation (prevents flash)
  if (authStore.loading) return true

  const isPublic = publicRoutes.includes(to.name as string)

  // Redirect unauthenticated users to login
  if (!authStore.isAuthenticated && !isPublic) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  // Redirect authenticated users away from public pages
  if (authStore.isAuthenticated && isPublic) {
    return { name: 'dms' }
  }

  return true
})

export default router
