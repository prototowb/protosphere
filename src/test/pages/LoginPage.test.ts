/**
 * Return after sign-in (lib/loginRedirect.ts): `/login?redirect=` is
 * followed after a password sign-in, for a visitor who is already signed in,
 * and across an OAuth round trip (useLoginRedirect).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

const { mockLogin, mockLoginWithOAuth } = vi.hoisted(() => ({
  mockLogin: vi.fn(),
  mockLoginWithOAuth: vi.fn(),
}))

vi.mock('@/lib/backend', () => ({ isLocalMode: false, backend: {} }))
vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({ login: mockLogin, loginWithOAuth: mockLoginWithOAuth, resetPassword: vi.fn() }),
}))

import LoginPage from '@/pages/LoginPage.vue'
import { useLoginRedirect } from '@/composables/useLoginRedirect'

const SESSION = { user: { id: 'u1', email: 'member@example.test' }, access_token: 'token' }
const LEARN_URL = 'https://typescript.protocode.xyz/lesson/3'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: LoginPage },
      { path: '/channels/@me', name: 'dms', component: { render: () => null } },
      { path: '/spaces/:serverId/:channelId', name: 'server-channel', component: { render: () => null } },
    ],
  })
}

describe('return after sign-in', () => {
  const originalLocation = window.location
  let assign: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
    setActivePinia(createPinia())
    assign = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, origin: 'https://chat.protocode.xyz', assign },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true })
  })

  async function mountLogin(query: string) {
    const router = makeRouter()
    await router.push(`/login${query}`)
    await router.isReady()
    const wrapper = mount(LoginPage, { global: { plugins: [router] } })
    await flushPromises()
    return { router, wrapper }
  }

  async function signInWithPassword(wrapper: Awaited<ReturnType<typeof mountLogin>>['wrapper']) {
    const store = useAuthStore()
    mockLogin.mockImplementation(async () => { store.setSession(SESSION) })
    await wrapper.find('#email').setValue('member@example.test')
    await wrapper.find('#password').setValue('secret')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
  }

  describe('password sign-in', () => {
    it('goes to an in-app redirect', async () => {
      const { router, wrapper } = await mountLogin('?redirect=%2Fspaces%2Fs1%2Fc1')
      await signInWithPassword(wrapper)
      expect(router.currentRoute.value.fullPath).toBe('/spaces/s1/c1')
      expect(assign).not.toHaveBeenCalled()
    })

    it('goes to a sibling app with a full navigation', async () => {
      const { wrapper } = await mountLogin(`?redirect=${encodeURIComponent(LEARN_URL)}`)
      await signInWithPassword(wrapper)
      expect(assign).toHaveBeenCalledExactlyOnceWith(LEARN_URL)
    })

    it.each(['https://protocode.xyz.evil.com/', '//evil.com', 'javascript:alert(1)'])(
      'goes to the default page for %s',
      async (redirect) => {
        const { router, wrapper } = await mountLogin(`?redirect=${encodeURIComponent(redirect)}`)
        await signInWithPassword(wrapper)
        expect(router.currentRoute.value.name).toBe('dms')
        expect(assign).not.toHaveBeenCalled()
      },
    )

    it('goes to the default page without a redirect', async () => {
      const { router, wrapper } = await mountLogin('')
      await signInWithPassword(wrapper)
      expect(router.currentRoute.value.name).toBe('dms')
    })
  })

  describe('a visitor who is already signed in', () => {
    it('is sent to a sibling app redirect', async () => {
      useAuthStore().setSession(SESSION)
      await mountLogin(`?redirect=${encodeURIComponent(LEARN_URL)}`)
      expect(assign).toHaveBeenCalledExactlyOnceWith(LEARN_URL)
    })

    it('is sent to an in-app redirect', async () => {
      useAuthStore().setSession(SESSION)
      const { router } = await mountLogin('?redirect=%2Fspaces%2Fs1%2Fc1')
      expect(router.currentRoute.value.fullPath).toBe('/spaces/s1/c1')
    })

    it('is sent there as soon as the stored session loads', async () => {
      const { router } = await mountLogin('?redirect=%2Fspaces%2Fs1%2Fc1')
      expect(router.currentRoute.value.name).toBe('login')

      useAuthStore().setSession(SESSION)
      await flushPromises()

      expect(router.currentRoute.value.fullPath).toBe('/spaces/s1/c1')
    })

    it('is sent to the default page for a hostile redirect', async () => {
      useAuthStore().setSession(SESSION)
      const { router } = await mountLogin(`?redirect=${encodeURIComponent('https://evilprotocode.xyz/')}`)
      expect(router.currentRoute.value.name).toBe('dms')
      expect(assign).not.toHaveBeenCalled()
    })
  })

  describe('OAuth round trip', () => {
    /** The app after the provider sends the visitor back to the default page. */
    async function returnFromProvider() {
      const router = makeRouter()
      const app = createApp(defineComponent({
        setup() {
          useLoginRedirect()
          return () => h(RouterView)
        },
      }))
      const pinia = createPinia()
      setActivePinia(pinia)
      app.use(pinia)
      app.use(router)
      await router.push('/channels/@me?code=oauth-code')
      app.mount(document.createElement('div'))
      await router.isReady()
      return { app, router, store: useAuthStore() }
    }

    it('keeps the redirect while away at the provider and follows it once signed in', async () => {
      const { wrapper } = await mountLogin(`?redirect=${encodeURIComponent(LEARN_URL)}`)
      mockLoginWithOAuth.mockResolvedValue(undefined)
      await wrapper.findAll('button').find((b) => b.text().includes('GitHub'))!.trigger('click')
      await flushPromises()
      expect(mockLoginWithOAuth).toHaveBeenCalledWith('github')

      const { app, store } = await returnFromProvider()
      expect(assign).not.toHaveBeenCalled()
      store.setSession(SESSION)
      await flushPromises()

      expect(assign).toHaveBeenCalledExactlyOnceWith(LEARN_URL)
      app.unmount()
    })

    it('follows an in-app redirect', async () => {
      const { wrapper } = await mountLogin('?redirect=%2Fspaces%2Fs1%2Fc1')
      await wrapper.findAll('button').find((b) => b.text().includes('Google'))!.trigger('click')
      await flushPromises()

      const { app, router, store } = await returnFromProvider()
      store.setSession(SESSION)
      await flushPromises()
      await nextTick()

      expect(router.currentRoute.value.fullPath).toBe('/spaces/s1/c1')
      app.unmount()
    })

    it('stays on the default page when the sign-in started without a redirect', async () => {
      const { wrapper } = await mountLogin('')
      await wrapper.findAll('button').find((b) => b.text().includes('GitHub'))!.trigger('click')
      await flushPromises()

      const { app, router, store } = await returnFromProvider()
      store.setSession(SESSION)
      await flushPromises()

      expect(router.currentRoute.value.path).toBe('/channels/@me')
      expect(assign).not.toHaveBeenCalled()
      app.unmount()
    })
  })
})
