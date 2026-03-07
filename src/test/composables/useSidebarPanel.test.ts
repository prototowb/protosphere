import { describe, it, expect, beforeEach } from 'vitest'
import { useSidebarPanel } from '@/composables/useSidebarPanel'
import type { Channel } from '@/lib/types'

const mockChannel = { id: 'ch1', name: 'general' } as Channel

describe('useSidebarPanel', () => {
  it('starts with no panel open', () => {
    const { activePanel, showPollsPanel, showEventsPanel, showPinnedPanel } = useSidebarPanel()
    expect(activePanel.value).toBeNull()
    expect(showPollsPanel.value).toBe(false)
    expect(showEventsPanel.value).toBe(false)
    expect(showPinnedPanel.value).toBe(false)
  })

  it('openPanel activates the given panel', () => {
    const { openPanel, showPollsPanel } = useSidebarPanel()
    openPanel('polls')
    expect(showPollsPanel.value).toBe(true)
  })

  it('openPanel same panel twice toggles it off', () => {
    const { openPanel, showPollsPanel } = useSidebarPanel()
    openPanel('polls')
    openPanel('polls')
    expect(showPollsPanel.value).toBe(false)
  })

  it('openPanel switches from one panel to another', () => {
    const { openPanel, showPollsPanel, showEventsPanel } = useSidebarPanel()
    openPanel('polls')
    openPanel('events')
    expect(showPollsPanel.value).toBe(false)
    expect(showEventsPanel.value).toBe(true)
  })

  it('openPanel clears activeThread', () => {
    const { openPanel, openThread, activeThread } = useSidebarPanel()
    openThread(mockChannel)
    expect(activeThread.value).toStrictEqual(mockChannel)
    openPanel('pinned')
    expect(activeThread.value).toBeNull()
  })

  it('openThread sets activePanel to thread and stores the channel', () => {
    const { openThread, activePanel, activeThread } = useSidebarPanel()
    openThread(mockChannel)
    expect(activePanel.value).toBe('thread')
    expect(activeThread.value).toStrictEqual(mockChannel)
  })

  it('closePanel resets everything', () => {
    const { openPanel, closePanel, activePanel, showPollsPanel } = useSidebarPanel()
    openPanel('polls')
    closePanel()
    expect(activePanel.value).toBeNull()
    expect(showPollsPanel.value).toBe(false)
  })

  it('closeOnChannelChange keeps thread open', () => {
    const { openThread, closeOnChannelChange, activePanel, activeThread } = useSidebarPanel()
    openThread(mockChannel)
    closeOnChannelChange()
    expect(activePanel.value).toBe('thread')
    expect(activeThread.value).toBeNull() // thread ref is cleared but panel stays
  })

  it('closeOnChannelChange clears non-thread panels', () => {
    const { openPanel, closeOnChannelChange, showPollsPanel } = useSidebarPanel()
    openPanel('polls')
    closeOnChannelChange()
    expect(showPollsPanel.value).toBe(false)
  })
})
