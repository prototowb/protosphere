import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('@/lib/emojiMap', () => ({
  // Mirrors the real contract: '' for anything that isn't a known emoji.
  getEmojiSvg: vi.fn(async (emoji: string) => (emoji === '😀' ? '<svg data-ok="1"></svg>' : '')),
}))

import EmojiIcon from '@/components/ui/EmojiIcon.vue'

describe('EmojiIcon', () => {
  it('renders the fetched SVG for a known emoji', async () => {
    const w = mount(EmojiIcon, { props: { emoji: '😀' } })
    await flushPromises()
    expect(w.find('svg[data-ok="1"]').exists()).toBe(true)
  })

  it('renders unknown input as text, never as markup', async () => {
    const payload = '<img src=x onerror="window.__pwned=1">'
    const w = mount(EmojiIcon, { props: { emoji: payload } })
    await flushPromises()
    expect(w.find('img').exists()).toBe(false)
    expect(w.text()).toBe(payload)
  })
})
