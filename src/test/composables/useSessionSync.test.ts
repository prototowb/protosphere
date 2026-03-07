import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { useSessionSync } from '@/composables/useSessionSync'
import { useAuthStore } from '@/stores/auth'

// Helper: mount the composable inside a real Vue app (needed for lifecycle hooks + useRouter)
function mountComposable() {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/login', name: 'login', component: { template: '<div/>' } },
    ],
  })

  let result!: ReturnType<typeof useSessionSync>
  const app = createApp({
    setup() {
      result = useSessionSync()
      return () => null
    },
    render() { return null },
  })
  app.use(pinia)
  app.use(router)
  const el = document.createElement('div')
  app.mount(el)

  return { result, app, router, pinia }
}

// Access the mock BroadcastChannel instances (set up in setup.ts)
const MockBC = globalThis.BroadcastChannel as unknown as {
  instances: { name: string; onmessage: ((e: MessageEvent) => void) | null; close: ReturnType<typeof vi.fn>; postMessage: (d: unknown) => void }[]
  reset: () => void
}

describe('useSessionSync', () => {
  beforeEach(() => {
    MockBC.reset()
    vi.clearAllMocks()
  })

  afterEach(({ task }) => {
    // suppress unused var warning
    void task
  })

  it('creates a BroadcastChannel on mount', () => {
    mountComposable()
    expect(MockBC.instances).toHaveLength(1)
    expect(MockBC.instances[0].name).toBe('protosphere_session_sync')
  })

  it('broadcastLogout posts logout message to channel', () => {
    const { result } = mountComposable()
    const postSpy = vi.spyOn(MockBC.instances[0], 'postMessage')
    result.broadcastLogout()
    expect(postSpy).toHaveBeenCalledWith({ type: 'logout' })
  })

  it('broadcastLogin posts login message to channel', () => {
    const { result } = mountComposable()
    const postSpy = vi.spyOn(MockBC.instances[0], 'postMessage')
    result.broadcastLogin()
    expect(postSpy).toHaveBeenCalledWith({ type: 'login' })
  })

  it('receiving logout when authenticated sets sessionExpired and clears auth', () => {
    const { result, pinia } = mountComposable()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    // Simulate authenticated state
    authStore.user = { id: 'u1', email: 'test@test.com' }
    authStore.session = { access_token: 'tok', refresh_token: 'ref', user: authStore.user }

    expect(result.sessionExpired.value).toBe(false)

    // Simulate receiving logout from another tab
    MockBC.instances[0].onmessage!(new MessageEvent('message', { data: { type: 'logout' } }))

    expect(result.sessionExpired.value).toBe(true)
    expect(authStore.user).toBeNull()
  })

  it('receiving logout when NOT authenticated is a no-op', () => {
    const { result } = mountComposable()
    MockBC.instances[0].onmessage!(new MessageEvent('message', { data: { type: 'logout' } }))
    expect(result.sessionExpired.value).toBe(false)
  })

  it('receiving login when not authenticated triggers reload', () => {
    mountComposable()
    MockBC.instances[0].onmessage!(new MessageEvent('message', { data: { type: 'login' } }))
    expect(window.location.reload).toHaveBeenCalledTimes(1)
  })

  it('dismissExpired resets sessionExpired and navigates to login', async () => {
    const { result, router } = mountComposable()
    const pushSpy = vi.spyOn(router, 'push')
    result.sessionExpired.value = true

    result.dismissExpired()

    expect(result.sessionExpired.value).toBe(false)
    expect(pushSpy).toHaveBeenCalledWith({ name: 'login' })
  })

  it('closes channel on unmount', () => {
    const { app } = mountComposable()
    const channel = MockBC.instances[0]
    app.unmount()
    expect(channel.close).toHaveBeenCalledTimes(1)
  })
})
