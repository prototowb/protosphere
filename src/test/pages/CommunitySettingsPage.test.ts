import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { CommunitySettings } from '@/lib/types'

const { mockUpdateCommunity, mockFetchCommunity, mockToastShow } = vi.hoisted(() => ({
  mockUpdateCommunity: vi.fn(),
  mockFetchCommunity: vi.fn(),
  mockToastShow: vi.fn(),
}))

vi.mock('@/composables/useCommunity', () => ({
  useCommunity: () => ({
    fetchCommunity: mockFetchCommunity,
    updateCommunity: mockUpdateCommunity,
  }),
}))

vi.mock('@/stores/toast', () => ({
  useToastStore: () => ({ show: mockToastShow }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ back: vi.fn() }),
}))

import CommunitySettingsPage from '@/pages/CommunitySettingsPage.vue'
import { useCommunityStore } from '@/stores/community'

const fakeSettings = (overrides: Partial<CommunitySettings> = {}): CommunitySettings => ({
  id: 'cs-1',
  name: 'Test Community',
  description: 'A test community',
  logo_url: 'https://example.com/logo.png',
  banner_url: 'https://example.com/banner.png',
  registration_mode: 'open',
  rules: 'Be nice',
  welcome_message: 'Welcome!',
  setup_complete: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

describe('CommunitySettingsPage — Branding section', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchCommunity.mockResolvedValue(undefined)
    mockUpdateCommunity.mockResolvedValue(undefined)
  })

  function mountPage(settings?: CommunitySettings) {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(CommunitySettingsPage, { global: { plugins: [pinia] } })
    if (settings) {
      const store = useCommunityStore()
      store.settings = settings
    }
    return wrapper
  }

  it('logo_url input appears in the Branding section', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const logoInput = wrapper.find('input[placeholder="https://example.com/logo.png"]')
    expect(logoInput.exists()).toBe(true)
  })

  it('banner_url input appears in the Branding section', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const bannerInput = wrapper.find('input[placeholder="https://example.com/banner.png"]')
    expect(bannerInput.exists()).toBe(true)
  })

  it('logo and banner inputs are initialized from communityStore.settings', async () => {
    const wrapper = mountPage(fakeSettings())
    await flushPromises()

    const logoInput = wrapper.find('input[placeholder="https://example.com/logo.png"]')
    const bannerInput = wrapper.find('input[placeholder="https://example.com/banner.png"]')

    expect((logoInput.element as HTMLInputElement).value).toBe('https://example.com/logo.png')
    expect((bannerInput.element as HTMLInputElement).value).toBe('https://example.com/banner.png')
  })

  it('handleSave passes logo_url and banner_url to updateCommunity', async () => {
    const wrapper = mountPage(fakeSettings())
    await flushPromises()

    const saveBtn = wrapper.find('button[disabled], button:not([disabled])')
    // Click the Save Changes button
    const buttons = wrapper.findAll('button')
    const saveButton = buttons.find(b => b.text().includes('Save'))
    expect(saveButton).toBeTruthy()
    await saveButton!.trigger('click')
    await flushPromises()

    expect(mockUpdateCommunity).toHaveBeenCalledWith(
      expect.objectContaining({
        logo_url: 'https://example.com/logo.png',
        banner_url: 'https://example.com/banner.png',
      }),
    )
  })

  it('handleSave passes null for empty logo_url and banner_url', async () => {
    const wrapper = mountPage(fakeSettings({ logo_url: null, banner_url: null }))
    await flushPromises()

    const buttons = wrapper.findAll('button')
    const saveButton = buttons.find(b => b.text().includes('Save'))
    await saveButton!.trigger('click')
    await flushPromises()

    expect(mockUpdateCommunity).toHaveBeenCalledWith(
      expect.objectContaining({
        logo_url: null,
        banner_url: null,
      }),
    )
  })
})
