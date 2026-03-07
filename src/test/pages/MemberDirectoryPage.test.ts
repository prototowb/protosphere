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
  },
}))

vi.mock('@/stores/presence', () => ({
  usePresenceStore: () => ({ getStatus: vi.fn().mockReturnValue('offline') }),
}))

vi.mock('@/components/user/UserAvatar.vue', () => ({
  default: { template: '<div class="user-avatar"/>' },
}))

import MemberDirectoryPage from '@/pages/MemberDirectoryPage.vue'
import { useServersStore } from '@/stores/servers'

function makeProfile(id: string, displayName: string, username: string): Profile {
  return {
    id,
    username,
    display_name: displayName,
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

function makeMember(userId: string, displayName: string, username: string): Member & { profile: Profile } {
  return {
    user_id: userId,
    server_id: 'server1',
    role: 'member',
    joined_at: '2024-01-01T00:00:00Z',
    profile: makeProfile(userId, displayName, username),
  } as Member & { profile: Profile }
}

describe('MemberDirectoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('shows loading skeletons initially', () => {
    mockMembersList.mockReturnValue(new Promise(() => {}))
    const pinia = createPinia()
    setActivePinia(pinia)
    const servers = useServersStore()
    servers.servers = [{ id: 'server1' }] as never

    const wrapper = mount(MemberDirectoryPage, { global: { plugins: [pinia] } })
    expect(wrapper.find('.animate-pulse').exists()).toBe(true)
  })

  it('displays all members after loading', async () => {
    mockMembersList.mockResolvedValue([
      makeMember('u1', 'Alice', 'alice'),
      makeMember('u2', 'Bob', 'bob'),
    ])
    const pinia = createPinia()
    setActivePinia(pinia)
    const servers = useServersStore()
    servers.servers = [{ id: 'server1' }] as never

    const wrapper = mount(MemberDirectoryPage, { global: { plugins: [pinia] } })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Bob')
  })

  it('filters members by display_name (case-insensitive)', async () => {
    mockMembersList.mockResolvedValue([
      makeMember('u1', 'Alice', 'alice'),
      makeMember('u2', 'Bob', 'bob'),
    ])
    const pinia = createPinia()
    setActivePinia(pinia)
    const servers = useServersStore()
    servers.servers = [{ id: 'server1' }] as never

    const wrapper = mount(MemberDirectoryPage, { global: { plugins: [pinia] } })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    await wrapper.find('input[type="text"]').setValue('ALI')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).not.toContain('Bob')
  })

  it('filters members by username', async () => {
    mockMembersList.mockResolvedValue([
      makeMember('u1', 'Alice Smith', 'alicesmith'),
      makeMember('u2', 'Bob Jones', 'bobjones'),
    ])
    const pinia = createPinia()
    setActivePinia(pinia)
    const servers = useServersStore()
    servers.servers = [{ id: 'server1' }] as never

    const wrapper = mount(MemberDirectoryPage, { global: { plugins: [pinia] } })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    await wrapper.find('input[type="text"]').setValue('bobjones')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).not.toContain('Alice Smith')
    expect(wrapper.text()).toContain('Bob Jones')
  })

  it('shows "No members found" when search matches nothing', async () => {
    mockMembersList.mockResolvedValue([makeMember('u1', 'Alice', 'alice')])
    const pinia = createPinia()
    setActivePinia(pinia)
    const servers = useServersStore()
    servers.servers = [{ id: 'server1' }] as never

    const wrapper = mount(MemberDirectoryPage, { global: { plugins: [pinia] } })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    await wrapper.find('input[type="text"]').setValue('zzz')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('No members found')
  })

  it('deduplicates members across multiple servers', async () => {
    mockMembersList.mockResolvedValue([makeMember('u1', 'Alice', 'alice')])
    const pinia = createPinia()
    setActivePinia(pinia)
    const servers = useServersStore()
    servers.servers = [{ id: 'server1' }, { id: 'server2' }] as never

    const wrapper = mount(MemberDirectoryPage, { global: { plugins: [pinia] } })
    await flushPromises()

    // Alice appears only once despite being in 2 servers
    const matches = wrapper.text().split('Alice').length - 1
    expect(matches).toBe(1)
  })
})
