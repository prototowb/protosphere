import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { followLoginRedirect, takeLoginRedirect } from '@/lib/loginRedirect'

/**
 * Finish a return-after-sign-in that went through an OAuth provider: once
 * the session arrives, go to the target LoginPage kept in sessionStorage
 * (lib/loginRedirect.ts). On /login itself, LoginPage follows `?redirect=`
 * instead. Mount once, in App.vue.
 */
export function useLoginRedirect() {
  const router = useRouter()
  const authStore = useAuthStore()

  watch(
    () => authStore.isAuthenticated,
    async (signedIn) => {
      if (!signedIn) return
      await router.isReady()
      if (router.currentRoute.value.name === 'login') return
      const target = takeLoginRedirect()
      if (target) followLoginRedirect(router, target)
    },
    { immediate: true },
  )
}
