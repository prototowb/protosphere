import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import type { CommunitySettings } from '@/lib/types'

const { mockCommunityGet, mockRegister, mockValidateInvite } = vi.hoisted(() => ({
  mockCommunityGet: vi.fn(),
  mockRegister: vi.fn(),
  mockValidateInvite: vi.fn(),
}))

vi.mock('@/lib/backend', () => ({
  isLocalMode: true,
  backend: {
    community: { get: mockCommunityGet },
    community_invites: { validate: mockValidateInvite, use: vi.fn() },
  },
}))

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    register: mockRegister,
    loginWithOAuth: vi.fn(),
  }),
}))

import RegisterPage from '@/pages/RegisterPage.vue'

const baseCommunitySettings: CommunitySettings = {
  id: 'c1',
  name: 'Test Community',
  description: '',
  rules: '',
  welcome_message: '',
  logo_url: null,
  banner_url: null,
  registration_mode: 'open',
  setup_complete: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/register', name: 'register', component: { template: '<div/>' } },
      { path: '/login', name: 'login', component: { template: '<div/>' } },
      { path: '/channels/@me', name: 'dms', component: { template: '<div/>' } },
    ],
  })
}

async function mountRegisterPage(registrationMode: CommunitySettings['registration_mode']) {
  mockCommunityGet.mockResolvedValue({ ...baseCommunitySettings, registration_mode: registrationMode })
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = makeRouter()
  await router.push('/register')
  const wrapper = mount(RegisterPage, {
    global: { plugins: [router, pinia], stubs: { RouterLink: true } },
  })
  await wrapper.vm.$nextTick()
  await wrapper.vm.$nextTick()
  return wrapper
}

describe('RegisterPage — registration mode enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows form in open mode', async () => {
    const wrapper = await mountRegisterPage('open')
    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Registration is closed')
  })

  it('hides form and shows closed message in closed mode', async () => {
    const wrapper = await mountRegisterPage('closed')
    expect(wrapper.text()).toContain('Registration is closed')
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('shows invite token field in invite_only mode', async () => {
    const wrapper = await mountRegisterPage('invite_only')
    expect(wrapper.find('#invite-token').exists()).toBe(true)
  })

  it('shows error when submitting invite_only without a token', async () => {
    const wrapper = await mountRegisterPage('invite_only')
    await wrapper.find('#email').setValue('user@test.com')
    await wrapper.find('#username').setValue('testuser')
    await wrapper.find('#password').setValue('password123')
    await wrapper.find('#confirm-password').setValue('password123')
    // Leave invite token empty
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('invite token is required')
  })

  it('shows error for invalid invite token in invite_only mode', async () => {
    mockValidateInvite.mockResolvedValue(null)
    const wrapper = await mountRegisterPage('invite_only')
    await wrapper.find('#email').setValue('user@test.com')
    await wrapper.find('#username').setValue('testuser')
    await wrapper.find('#password').setValue('password123')
    await wrapper.find('#confirm-password').setValue('password123')
    await wrapper.find('#invite-token').setValue('bad-token')
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Invalid or expired invite token')
  })

  it('shows "Request Access" button in approval mode', async () => {
    const wrapper = await mountRegisterPage('approval')
    const submitBtn = wrapper.find('button[type="submit"]')
    expect(submitBtn.text()).toContain('Request Access')
  })

  it('shows pending approval state after submitting in approval mode', async () => {
    mockRegister.mockResolvedValue({ needsConfirmation: false })
    const wrapper = await mountRegisterPage('approval')
    await wrapper.find('#email').setValue('user@test.com')
    await wrapper.find('#username').setValue('testuser')
    await wrapper.find('#password').setValue('password123')
    await wrapper.find('#confirm-password').setValue('password123')
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('pending admin approval')
  })
})
