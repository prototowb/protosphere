import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const publicRoutes = ['login', 'register', 'landing', 'reset-password', 'confirm-email', 'not-found', 'error', 'join-community']

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
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/pages/ResetPasswordPage.vue'),
    },
    {
      path: '/confirm-email',
      name: 'confirm-email',
      component: () => import('@/pages/ConfirmEmailPage.vue'),
    },
    {
      path: '/admin/approvals',
      name: 'admin-approvals',
      component: () => import('@/pages/AdminApprovalsPage.vue'),
    },
    {
      path: '/join/:token',
      name: 'join-community',
      component: () => import('@/pages/JoinCommunityPage.vue'),
    },
    {
      path: '/community/members',
      name: 'community-members',
      component: () => import('@/pages/MemberDirectoryPage.vue'),
    },
    {
      path: '/404',
      name: 'not-found',
      component: () => import('@/pages/NotFoundPage.vue'),
    },
    {
      path: '/error',
      name: 'error',
      component: () => import('@/pages/ErrorPage.vue'),
      props: (route) => ({ error: route.query.error as string | undefined }),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'catch-all',
      component: () => import('@/pages/NotFoundPage.vue'),
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
