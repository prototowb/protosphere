import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import type { Profile } from '@/lib/types'

const { mockFetchProfile, mockUpdateProfile, mockUploadAvatar, mockLogout, mockLogoutGlobal, mockToastShow } = vi.hoisted(() => ({
  mockFetchProfile: vi.fn(),
  mockUpdateProfile: vi.fn(),
  mockUploadAvatar: vi.fn(),
  mockLogout: vi.fn(),
  mockLogoutGlobal: vi.fn(),
  mockToastShow: vi.fn(),
}))

vi.mock('@/composables/useProfile', () => ({
  useProfile: () => ({
    profile: { value: null },
    loading: { value: false },
    error: { value: null },
    fetchProfile: mockFetchProfile,
    updateProfile: mockUpdateProfile,
    uploadAvatar: mockUploadAvatar,
  }),
}))

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    logout: mockLogout,
    logoutGlobal: mockLogoutGlobal,
  }),
}))

vi.mock('@/stores/toast', () => ({
  useToastStore: () => ({ show: mockToastShow }),
}))

vi.mock('@/components/user/UserAvatar.vue', () => ({
  default: { template: '<div class="user-avatar"/>' },
}))

import SettingsPage from '@/pages/SettingsPage.vue'

const fakeProfile = (): Profile => ({
  id: 'u1',
  username: 'alice',
  display_name: 'Alice',
  avatar_url: null,
  bio: '',
  status: 'online',
  status_text: '',
  pronouns: '',
  website: '',
  location: '',
  display_banner_url: null,
  account_status: 'active',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
})

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/settings', name: 'settings', component: { template: '<div/>' } },
      { path: '/login', name: 'login', component: { template: '<div/>' } },
      { path: '/channels/@me', name: 'dms', component: { template: '<div/>' } },
    ],
  })
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchProfile.mockResolvedValue(undefined)
    mockLogout.mockResolvedValue(undefined)
    mockLogoutGlobal.mockResolvedValue(undefined)
    setActivePinia(createPinia())
  })

  function mountPage() {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = makeRouter()
    return { wrapper: mount(SettingsPage, { global: { plugins: [pinia, router] } }), router }
  }

  it('calls fetchProfile on mount', async () => {
    mountPage()
    await flushPromises()
    expect(mockFetchProfile).toHaveBeenCalledOnce()
  })

  it('"Log out" button calls logout and navigates to /login', async () => {
    const { wrapper, router } = mountPage()
    await flushPromises()

    const buttons = wrapper.findAll('button')
    const logoutBtn = buttons.find(b => b.text() === 'Log out')
    expect(logoutBtn).toBeTruthy()
    await logoutBtn!.trigger('click')
    await flushPromises()

    expect(mockLogout).toHaveBeenCalledOnce()
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('"Sign out everywhere" button exists', async () => {
    const { wrapper } = mountPage()
    await flushPromises()

    const buttons = wrapper.findAll('button')
    const globalBtn = buttons.find(b => b.text().toLowerCase().includes('everywhere'))
    expect(globalBtn).toBeTruthy()
  })

  it('"Sign out everywhere" calls logoutGlobal and navigates to /login', async () => {
    const { wrapper, router } = mountPage()
    await flushPromises()

    const buttons = wrapper.findAll('button')
    const globalBtn = buttons.find(b => b.text().toLowerCase().includes('everywhere'))
    await globalBtn!.trigger('click')
    await flushPromises()

    expect(mockLogoutGlobal).toHaveBeenCalledOnce()
    expect(mockLogout).not.toHaveBeenCalled()
    expect(router.currentRoute.value.name).toBe('login')
  })
})
