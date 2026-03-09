import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import type { CommunitySettings } from '@/lib/types'

vi.mock('@/composables/useServers', () => ({
  useServers: () => ({
    createServer: vi.fn(),
    joinServer: vi.fn(),
    leaveServer: vi.fn(),
    deleteServer: vi.fn(),
    regenerateInviteCode: vi.fn(),
  }),
}))

vi.mock('@/composables/useCommunity', () => ({
  useCommunity: () => ({ fetchCommunity: vi.fn() }),
}))

vi.mock('@/composables/useDmUnread', () => ({
  useDmUnread: () => ({ totalDmUnread: { value: 0 } }),
}))

vi.mock('@/stores/contextMenu', () => ({
  useContextMenuStore: () => ({ show: vi.fn() }),
}))

vi.mock('@/stores/toast', () => ({
  useToastStore: () => ({ show: vi.fn() }),
}))

vi.mock('@/stores/mentions', () => ({
  useMentionsStore: () => ({ mentionsByServer: {} }),
}))

vi.mock('@/components/server/CreateServerDialog.vue', () => ({
  default: { template: '<div/>' },
}))
vi.mock('@/components/server/JoinServerDialog.vue', () => ({
  default: { template: '<div/>' },
}))
vi.mock('@/components/ui/ConfirmDialog.vue', () => ({
  default: { template: '<div/>' },
}))

import CommunitySidebar from '@/components/layout/CommunitySidebar.vue'
import { useServersStore } from '@/stores/servers'
import { useCommunityStore } from '@/stores/community'
import { useAuthStore } from '@/stores/auth'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/channels/@me', component: { template: '<div/>' } },
      { path: '/channels/:serverId/:channelId', component: { template: '<div/>' } },
      { path: '/community/members', component: { template: '<div/>' } },
      { path: '/admin/approvals', component: { template: '<div/>' } },
      { path: '/admin/community', component: { template: '<div/>' } },
    ],
  })
}

function makeCommunitySettings(registration_mode: CommunitySettings['registration_mode']): CommunitySettings {
  return {
    id: 'c1',
    name: 'Test Community',
    description: '',
    logo_url: null,
    banner_url: null,
    rules: '',
    welcome_message: '',
    registration_mode,
    setup_complete: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }
}

describe('CommunitySidebar — nav links', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('shows Members link in nav', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = makeRouter()

    const wrapper = mount(CommunitySidebar, {
      global: { plugins: [pinia, router] },
    })
    await router.isReady()

    expect(wrapper.html()).toContain('/community/members')
    expect(wrapper.text()).toContain('Members')
  })

  it('shows Approvals link when owner and registration_mode=approval', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = makeRouter()

    const auth = useAuthStore()
    auth.user = { id: 'owner1', email: 'a@b.com' } as never

    const servers = useServersStore()
    servers.servers = [{ id: 's1', name: 'General', owner_id: 'owner1', sort_order: 0, visibility: 'public' }] as never

    const community = useCommunityStore()
    community.settings = makeCommunitySettings('approval')

    const wrapper = mount(CommunitySidebar, {
      global: { plugins: [pinia, router] },
    })
    await router.isReady()

    expect(wrapper.html()).toContain('/admin/approvals')
    expect(wrapper.text()).toContain('Approvals')
  })

  it('hides Approvals link when registration_mode=open', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = makeRouter()

    const auth = useAuthStore()
    auth.user = { id: 'owner1', email: 'a@b.com' } as never

    const servers = useServersStore()
    servers.servers = [{ id: 's1', name: 'General', owner_id: 'owner1', sort_order: 0, visibility: 'public' }] as never

    const community = useCommunityStore()
    community.settings = makeCommunitySettings('open')

    const wrapper = mount(CommunitySidebar, {
      global: { plugins: [pinia, router] },
    })
    await router.isReady()

    expect(wrapper.html()).not.toContain('/admin/approvals')
    expect(wrapper.text()).not.toContain('Approvals')
  })

  it('hides Approvals link when user is not an owner (even in approval mode)', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = makeRouter()

    const auth = useAuthStore()
    auth.user = { id: 'regular-user', email: 'a@b.com' } as never

    const servers = useServersStore()
    servers.servers = [{ id: 's1', name: 'General', owner_id: 'someone-else', sort_order: 0, visibility: 'public' }] as never

    const community = useCommunityStore()
    community.settings = makeCommunitySettings('approval')

    const wrapper = mount(CommunitySidebar, {
      global: { plugins: [pinia, router] },
    })
    await router.isReady()

    expect(wrapper.html()).not.toContain('/admin/approvals')
  })
})
