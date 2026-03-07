import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Profile } from '@/lib/types'

const { mockListPending, mockApprove, mockReject, mockToastShow } = vi.hoisted(() => ({
  mockListPending: vi.fn(),
  mockApprove: vi.fn(),
  mockReject: vi.fn(),
  mockToastShow: vi.fn(),
}))

vi.mock('@/lib/backend', () => ({
  isLocalMode: true,
  backend: {
    profiles: {
      listPending: mockListPending,
      approve: mockApprove,
      reject: mockReject,
    },
  },
}))

vi.mock('@/stores/toast', () => ({
  useToastStore: () => ({ show: mockToastShow }),
}))

import AdminApprovalsPage from '@/pages/AdminApprovalsPage.vue'

const fakeProfile = (id: string): Profile => ({
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
  account_status: 'pending',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
})

describe('AdminApprovalsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('shows loading skeletons initially', () => {
    mockListPending.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(AdminApprovalsPage, { global: { plugins: [createPinia()] } })
    expect(wrapper.find('.animate-pulse').exists()).toBe(true)
  })

  it('shows empty state when no pending users', async () => {
    mockListPending.mockResolvedValue([])
    const wrapper = mount(AdminApprovalsPage, { global: { plugins: [createPinia()] } })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('No pending approvals')
  })

  it('shows error message when loading fails', async () => {
    mockListPending.mockRejectedValue(new Error('Forbidden'))
    const wrapper = mount(AdminApprovalsPage, { global: { plugins: [createPinia()] } })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Forbidden')
  })

  it('lists pending users', async () => {
    mockListPending.mockResolvedValue([fakeProfile('1'), fakeProfile('2')])
    const wrapper = mount(AdminApprovalsPage, { global: { plugins: [createPinia()] } })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('User 1')
    expect(wrapper.text()).toContain('User 2')
  })

  it('Approve button calls backend.profiles.approve and removes user from list', async () => {
    mockListPending.mockResolvedValue([fakeProfile('1'), fakeProfile('2')])
    mockApprove.mockResolvedValue(undefined)
    const wrapper = mount(AdminApprovalsPage, { global: { plugins: [createPinia()] } })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const approveBtn = wrapper.findAll('button').find((b) => b.text() === 'Approve')
    await approveBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(mockApprove).toHaveBeenCalledWith('1')
    expect(mockToastShow).toHaveBeenCalledWith('User approved', 'success')
    expect(wrapper.text()).not.toContain('User 1')
    expect(wrapper.text()).toContain('User 2')
  })

  it('Reject button calls backend.profiles.reject and removes user from list', async () => {
    mockListPending.mockResolvedValue([fakeProfile('1')])
    mockReject.mockResolvedValue(undefined)
    const wrapper = mount(AdminApprovalsPage, { global: { plugins: [createPinia()] } })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const rejectBtn = wrapper.findAll('button').find((b) => b.text() === 'Reject')
    await rejectBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(mockReject).toHaveBeenCalledWith('1')
    expect(wrapper.text()).toContain('No pending approvals')
  })
})
