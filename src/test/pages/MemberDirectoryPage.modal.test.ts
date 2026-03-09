import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Member, Profile } from '@/lib/types'

const { mockMembersList } = vi.hoisted(() => ({
  mockMembersList: vi.fn(),
}))

vi.mock('@/lib/backend', () => ({
  isLocalMode: true,
  backend: {
    members: { list: mockMembersList },
    profiles: { get: vi.fn() },
  },
}))

vi.mock('@/stores/presence', () => ({
  usePresenceStore: () => ({ getStatus: vi.fn().mockReturnValue('offline') }),
}))

vi.mock('@/components/user/UserAvatar.vue', () => ({
  default: { template: '<div class="user-avatar"/>' },
}))

vi.mock('@/components/user/UserProfileModal.vue', () => ({
  default: {
    props: ['userId'],
    emits: ['close'],
    template: '<div class="user-profile-modal" :data-user-id="userId"/>',
  },
}))

import MemberDirectoryPage from '@/pages/MemberDirectoryPage.vue'
import { useServersStore } from '@/stores/servers'

function makeProfile(id: string): Profile {
  return {
    id,
    username: `user${id}`,
    display_name: `User ${id}`,
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
  }
}

function makeMember(userId: string): Member & { profile: Profile } {
  return {
    user_id: userId,
    server_id: 'server1',
    role: 'member',
    joined_at: '2024-01-01T00:00:00Z',
    profile: makeProfile(userId),
  } as Member & { profile: Profile }
}

describe('MemberDirectoryPage — modal integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('opens UserProfileModal when a member row is clicked', async () => {
    mockMembersList.mockResolvedValue([makeMember('u1'), makeMember('u2')])
    const pinia = createPinia()
    setActivePinia(pinia)
    const servers = useServersStore()
    servers.servers = [{ id: 'server1' }] as never

    const wrapper = mount(MemberDirectoryPage, { global: { plugins: [pinia] } })
    await flushPromises()

    // Modal should not be visible yet
    expect(wrapper.find('.user-profile-modal').exists()).toBe(false)

    // Click first member button
    const buttons = wrapper.findAll('button')
    await buttons[0].trigger('click')
    await wrapper.vm.$nextTick()

    const modal = wrapper.find('.user-profile-modal')
    expect(modal.exists()).toBe(true)
    expect(modal.attributes('data-user-id')).toBe('u1')
  })

  it('closes UserProfileModal when @close is emitted', async () => {
    mockMembersList.mockResolvedValue([makeMember('u1')])
    const pinia = createPinia()
    setActivePinia(pinia)
    const servers = useServersStore()
    servers.servers = [{ id: 'server1' }] as never

    const wrapper = mount(MemberDirectoryPage, { global: { plugins: [pinia] } })
    await flushPromises()

    await wrapper.findAll('button')[0].trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.user-profile-modal').exists()).toBe(true)

    await wrapper.findComponent({ name: 'UserProfileModal' }).vm.$emit('close')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.user-profile-modal').exists()).toBe(false)
  })

  it('opens modal for the correct member when second member is clicked', async () => {
    mockMembersList.mockResolvedValue([makeMember('u1'), makeMember('u2')])
    const pinia = createPinia()
    setActivePinia(pinia)
    const servers = useServersStore()
    servers.servers = [{ id: 'server1' }] as never

    const wrapper = mount(MemberDirectoryPage, { global: { plugins: [pinia] } })
    await flushPromises()

    const buttons = wrapper.findAll('button')
    await buttons[1].trigger('click')
    await wrapper.vm.$nextTick()

    const modal = wrapper.find('.user-profile-modal')
    expect(modal.exists()).toBe(true)
    expect(modal.attributes('data-user-id')).toBe('u2')
  })
})
