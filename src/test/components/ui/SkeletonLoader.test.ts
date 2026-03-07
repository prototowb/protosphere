import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'

describe('SkeletonLoader', () => {
  it('renders a single skeleton with animate-pulse by default', () => {
    const wrapper = mount(SkeletonLoader)
    const el = wrapper.find('.animate-pulse')
    expect(el.exists()).toBe(true)
  })

  it('renders multiple skeleton lines when lines > 1', () => {
    const wrapper = mount(SkeletonLoader, { props: { lines: 3 } })
    const lines = wrapper.findAll('.animate-pulse')
    expect(lines).toHaveLength(3)
  })

  it('renders a single skeleton when lines === 1', () => {
    const wrapper = mount(SkeletonLoader, { props: { lines: 1 } })
    // lines=1 falls through to the single-div branch
    const el = wrapper.find('.animate-pulse')
    expect(el.exists()).toBe(true)
    // Should not be a list container
    expect(wrapper.find('.space-y-2').exists()).toBe(false)
  })

  it('applies rounded-full class when circle=true', () => {
    const wrapper = mount(SkeletonLoader, { props: { circle: true } })
    expect(wrapper.find('.rounded-full').exists()).toBe(true)
  })

  it('applies rounded-lg class when rounded=true (and not circle)', () => {
    const wrapper = mount(SkeletonLoader, { props: { rounded: true } })
    expect(wrapper.find('.rounded-lg').exists()).toBe(true)
  })

  it('applies default rounded class when no shape props', () => {
    const wrapper = mount(SkeletonLoader)
    const el = wrapper.find('.animate-pulse')
    expect(el.classes()).toContain('rounded')
  })

  it('applies custom width and height via style', () => {
    const wrapper = mount(SkeletonLoader, { props: { width: '200px', height: '40px' } })
    const el = wrapper.find('.animate-pulse')
    expect(el.attributes('style')).toContain('width: 200px')
    expect(el.attributes('style')).toContain('height: 40px')
  })

  it('last line in multi-line skeleton is narrower (70%)', () => {
    const wrapper = mount(SkeletonLoader, { props: { lines: 3 } })
    const lines = wrapper.findAll('.animate-pulse')
    const lastStyle = lines[2].attributes('style') ?? ''
    expect(lastStyle).toContain('width: 70%')
  })
})
