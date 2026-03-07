import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'

const { mockValidate, mockUse } = vi.hoisted(() => ({
  mockValidate: vi.fn(),
  mockUse: vi.fn(),
}))

vi.mock('@/lib/backend', () => ({
  isLocalMode: false,
  backend: {
    community_invites: {
      validate: mockValidate,
      use: mockUse,
    },
  },
}))

vi.mock('@/stores/toast', () => ({
  useToastStore: () => ({ show: vi.fn() }),
}))

import JoinCommunityPage from '@/pages/JoinCommunityPage.vue'

function makeRouter(token = 'tok123') {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/join/:token', name: 'join-community', component: { template: '<div/>' } },
      { path: '/register', name: 'register', component: { template: '<div/>' } },
      { path: '/login', name: 'login', component: { template: '<div/>' } },
      { path: '/channels/@me', name: 'dms', component: { template: '<div/>' } },
    ],
  })
}

describe('JoinCommunityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('shows "Checking invite link..." while validating', async () => {
    mockValidate.mockReturnValue(new Promise(() => {}))
    const router = makeRouter()
    await router.push('/join/tok123')
    const wrapper = mount(JoinCommunityPage, {
      global: { plugins: [router, createPinia()], stubs: { RouterLink: true } },
    })
    expect(wrapper.text()).toContain('Checking invite link')
  })

  it('shows invalid state when validate returns null', async () => {
    mockValidate.mockResolvedValue(null)
    const router = makeRouter()
    await router.push('/join/tok123')
    const wrapper = mount(JoinCommunityPage, {
      global: { plugins: [router, createPinia()], stubs: { RouterLink: true } },
    })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Invalid Invite')
  })

  it('shows invalid state when validate throws (Fix 2 regression test)', async () => {
    mockValidate.mockRejectedValue(new Error('Network error'))
    const router = makeRouter()
    await router.push('/join/tok123')
    const wrapper = mount(JoinCommunityPage, {
      global: { plugins: [router, createPinia()], stubs: { RouterLink: true } },
    })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Invalid Invite')
  })

  it('shows invite card for valid token when not authenticated', async () => {
    mockValidate.mockResolvedValue({ id: 'inv1', token: 'tok123' })
    const router = makeRouter()
    await router.push('/join/tok123')
    const wrapper = mount(JoinCommunityPage, {
      global: { plugins: [router, createPinia()], stubs: { RouterLink: true } },
    })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain("You're invited")
    expect(wrapper.text()).toContain('Register to Join')
  })
})
