import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Profile } from '@/lib/types'

const { mockProfileGet } = vi.hoisted(() => ({
  mockProfileGet: vi.fn(),
}))

vi.mock('@/lib/backend', () => ({
  isLocalMode: true,
  backend: {
    profiles: { get: mockProfileGet },
  },
}))

vi.mock('@/stores/presence', () => ({
  usePresenceStore: () => ({ getStatus: vi.fn().mockReturnValue('offline') }),
}))

vi.mock('@/components/user/UserAvatar.vue', () => ({
  default: {
    props: ['src', 'alt', 'status', 'size', 'class'],
    template: '<div class="user-avatar"/>',
  },
}))

import UserProfileModal from '@/components/user/UserProfileModal.vue'

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'u1',
    username: 'testuser',
    display_name: 'Test User',
    avatar_url: null,
    bio: '',
    status: 'offline',
    status_text: '',
    pronouns: '',
    website: '',
    location: '',
    display_banner_url: null,
    account_status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('UserProfileModal — rich profile fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('displays pronouns when present', async () => {
    mockProfileGet.mockResolvedValue(makeProfile({ pronouns: 'they/them' }))
    const wrapper = mount(UserProfileModal, {
      props: { userId: 'u1' },
      global: { plugins: [createPinia()] },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('they/them')
  })

  it('displays website as a link when present', async () => {
    mockProfileGet.mockResolvedValue(makeProfile({ website: 'https://example.com' }))
    const wrapper = mount(UserProfileModal, {
      props: { userId: 'u1' },
      global: { plugins: [createPinia()] },
    })
    await flushPromises()

    const link = wrapper.find('a[href="https://example.com"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toContain('noopener')
  })

  it('displays location when present', async () => {
    mockProfileGet.mockResolvedValue(makeProfile({ location: 'Berlin, Germany' }))
    const wrapper = mount(UserProfileModal, {
      props: { userId: 'u1' },
      global: { plugins: [createPinia()] },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Berlin, Germany')
  })

  it('hides rich fields when all are empty', async () => {
    mockProfileGet.mockResolvedValue(makeProfile({ pronouns: '', website: '', location: '' }))
    const wrapper = mount(UserProfileModal, {
      props: { userId: 'u1' },
      global: { plugins: [createPinia()] },
    })
    await flushPromises()

    // No extra elements for empty rich fields
    expect(wrapper.find('a[target="_blank"]').exists()).toBe(false)
  })

  it('emits close when backdrop is clicked', async () => {
    mockProfileGet.mockResolvedValue(makeProfile())
    const wrapper = mount(UserProfileModal, {
      props: { userId: 'u1' },
      global: { plugins: [createPinia()] },
    })
    await flushPromises()

    await wrapper.find('.absolute.inset-0').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
