import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia } from 'pinia'

const { mockUpdateUser } = vi.hoisted(() => ({
  mockUpdateUser: vi.fn().mockResolvedValue({ error: null }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { updateUser: mockUpdateUser },
  },
}))

// Tests run in Supabase mode (isLocalMode = false) so the form is visible
vi.mock('@/lib/backend', () => ({
  isLocalMode: false,
  backend: {},
}))

import ResetPasswordPage from '@/pages/ResetPasswordPage.vue'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/reset-password', name: 'reset-password', component: { template: '<div/>' } },
      { path: '/login', name: 'login', component: { template: '<div/>' } },
    ],
  })
}

async function mountPage(hash = '') {
  window.location.hash = hash
  const wrapper = mount(ResetPasswordPage, {
    global: { plugins: [makeRouter(), createPinia()], stubs: { RouterLink: true } },
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    window.location.hash = ''
    vi.clearAllMocks()
  })

  it('shows invalid link state when URL hash does not contain type=recovery', async () => {
    const wrapper = await mountPage('#type=email_change')
    expect(wrapper.text()).toContain('Invalid or expired reset link')
  })

  it('shows the password form when URL hash contains type=recovery', async () => {
    const wrapper = await mountPage('#type=recovery')
    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('shows error when passwords do not match', async () => {
    const wrapper = await mountPage('#type=recovery')
    const inputs = wrapper.findAll('input[type="password"]')
    await inputs[0].setValue('password123')
    await inputs[1].setValue('different456')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('Passwords do not match')
  })

  it('shows error when password is too short', async () => {
    const wrapper = await mountPage('#type=recovery')
    const inputs = wrapper.findAll('input[type="password"]')
    await inputs[0].setValue('short')
    await inputs[1].setValue('short')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('at least 8 characters')
  })

  it('calls supabase.auth.updateUser on valid submit and shows success', async () => {
    const wrapper = await mountPage('#type=recovery')
    const inputs = wrapper.findAll('input[type="password"]')
    await inputs[0].setValue('newpassword123')
    await inputs[1].setValue('newpassword123')
    await wrapper.find('form').trigger('submit')
    // Wait for async resolve
    await new Promise((r) => setTimeout(r, 10))
    await wrapper.vm.$nextTick()

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newpassword123' })
    expect(wrapper.text()).toContain('Password updated successfully')
  })

  it('shows generic error message when updateUser rejects', async () => {
    mockUpdateUser.mockRejectedValue(new Error('Auth session missing'))
    const wrapper = await mountPage('#type=recovery')
    const inputs = wrapper.findAll('input[type="password"]')
    await inputs[0].setValue('newpassword123')
    await inputs[1].setValue('newpassword123')
    await wrapper.find('form').trigger('submit')
    await new Promise((r) => setTimeout(r, 10))
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Auth session missing')
  })
})
