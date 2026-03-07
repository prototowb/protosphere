import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import EmptyState from '@/components/ui/EmptyState.vue'

describe('EmptyState', () => {
  it('renders the title', () => {
    const wrapper = mount(EmptyState, { props: { title: 'Nothing here' } })
    expect(wrapper.text()).toContain('Nothing here')
  })

  it('renders description when provided', () => {
    const wrapper = mount(EmptyState, {
      props: { title: 'Empty', description: 'Start by creating something' },
    })
    expect(wrapper.text()).toContain('Start by creating something')
  })

  it('does not render description when omitted', () => {
    const wrapper = mount(EmptyState, { props: { title: 'Empty' } })
    // No second paragraph
    expect(wrapper.findAll('p')).toHaveLength(1)
  })

  it('renders icon when provided', () => {
    const wrapper = mount(EmptyState, { props: { title: 'Empty', icon: '📭' } })
    expect(wrapper.text()).toContain('📭')
  })

  it('does not render the icon div when icon is omitted', () => {
    const wrapper = mount(EmptyState, { props: { title: 'Empty' } })
    expect(wrapper.find('.text-4xl').exists()).toBe(false)
  })

  it('renders action button when actionLabel is provided', () => {
    const wrapper = mount(EmptyState, { props: { title: 'Empty', actionLabel: 'Create one' } })
    const btn = wrapper.find('button')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toBe('Create one')
  })

  it('does not render action button when actionLabel is omitted', () => {
    const wrapper = mount(EmptyState, { props: { title: 'Empty' } })
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('emits action event when button is clicked', async () => {
    const wrapper = mount(EmptyState, { props: { title: 'Empty', actionLabel: 'Do it' } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('action')).toHaveLength(1)
  })
})
