import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

const { mockLogin, mockRegister, mockLogout, mockLogoutGlobal, mockUpdatePassword, mockResetPassword, mockInit } = vi.hoisted(() => ({
  mockLogin: vi.fn(),
  mockRegister: vi.fn(),
  mockLogout: vi.fn(),
  mockLogoutGlobal: vi.fn(),
  mockUpdatePassword: vi.fn(),
  mockResetPassword: vi.fn(),
  mockInit: vi.fn(),
}))

vi.mock('@/lib/backend', () => ({
  isLocalMode: true,
  backend: {
    auth: {
      login: mockLogin,
      register: mockRegister,
      logout: mockLogout,
      logoutGlobal: mockLogoutGlobal,
      loginWithOAuth: vi.fn(),
      resetPassword: mockResetPassword,
      updatePassword: mockUpdatePassword,
      init: mockInit,
    },
  },
}))

import { useAuth } from '@/composables/useAuth'
import { useAuthStore } from '@/stores/auth'

function mountComposable() {
  const pinia = createPinia()
  setActivePinia(pinia)
  let result!: ReturnType<typeof useAuth>
  const app = createApp({
    setup() { result = useAuth(); return () => null },
    render() { return null },
  })
  app.use(pinia)
  app.mount(document.createElement('div'))
  return { result, store: useAuthStore() }
}

describe('useAuth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('login delegates to backend.auth.login', async () => {
    mockLogin.mockResolvedValue(undefined)
    const { result } = mountComposable()
    await result.login('a@b.com', 'secret')
    expect(mockLogin).toHaveBeenCalledWith('a@b.com', 'secret')
  })

  it('logout calls backend.auth.logout and clears authStore', async () => {
    mockLogout.mockResolvedValue(undefined)
    const { result, store } = mountComposable()
    // Simulate a logged-in state
    store.user = { id: 'u1', email: 'a@b.com' }
    await result.logout()
    expect(mockLogout).toHaveBeenCalledOnce()
    expect(store.user).toBeNull()
  })

  it('logoutGlobal calls backend.auth.logoutGlobal and clears authStore', async () => {
    mockLogoutGlobal.mockResolvedValue(undefined)
    const { result, store } = mountComposable()
    store.user = { id: 'u1', email: 'a@b.com' }
    await result.logoutGlobal()
    expect(mockLogoutGlobal).toHaveBeenCalledOnce()
    expect(mockLogout).not.toHaveBeenCalled()
    expect(store.user).toBeNull()
  })

  it('logoutGlobal does not call regular logout', async () => {
    mockLogoutGlobal.mockResolvedValue(undefined)
    const { result } = mountComposable()
    await result.logoutGlobal()
    expect(mockLogout).not.toHaveBeenCalled()
  })

  it('updatePassword delegates to backend.auth.updatePassword', async () => {
    mockUpdatePassword.mockResolvedValue(undefined)
    const { result } = mountComposable()
    await result.updatePassword('newpass')
    expect(mockUpdatePassword).toHaveBeenCalledWith('newpass')
  })

  it('resetPassword delegates to backend.auth.resetPassword', async () => {
    mockResetPassword.mockResolvedValue(undefined)
    const { result } = mountComposable()
    await result.resetPassword('a@b.com')
    expect(mockResetPassword).toHaveBeenCalledWith('a@b.com')
  })
})
