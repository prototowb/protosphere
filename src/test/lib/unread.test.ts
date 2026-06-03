import { describe, it, expect } from 'vitest'
import { isChannelUnread } from '@/lib/unread'

const ME = 'user-me'
const OTHER = 'user-other'

function msg(author_id: string, created_at: string) {
  return { author_id, created_at }
}

describe('isChannelUnread', () => {
  it('returns false when messages array is empty', () => {
    expect(isChannelUnread([], undefined, ME)).toBe(false)
  })

  it('returns false when all messages are from the current user', () => {
    expect(isChannelUnread([msg(ME, '2026-01-01T01:00:00Z')], undefined, ME)).toBe(false)
  })

  it('returns true when never visited (no lastReadIso) and others have posted', () => {
    expect(isChannelUnread([msg(OTHER, '2026-01-01T01:00:00Z')], undefined, ME)).toBe(true)
  })

  it('returns false when others posted before lastReadIso', () => {
    const messages = [msg(OTHER, '2026-01-01T10:00:00Z')]
    expect(isChannelUnread(messages, '2026-01-01T12:00:00Z', ME)).toBe(false)
  })

  it('returns true when others posted after lastReadIso', () => {
    const messages = [msg(OTHER, '2026-01-01T14:00:00Z')]
    expect(isChannelUnread(messages, '2026-01-01T12:00:00Z', ME)).toBe(true)
  })

  it('ignores own messages when checking against lastReadIso', () => {
    const messages = [
      msg(ME, '2026-01-01T15:00:00Z'),    // own, after lastRead
      msg(OTHER, '2026-01-01T10:00:00Z'), // other, before lastRead
    ]
    expect(isChannelUnread(messages, '2026-01-01T12:00:00Z', ME)).toBe(false)
  })

  it('returns true when at least one other message is newer than lastReadIso', () => {
    const messages = [
      msg(OTHER, '2026-01-01T10:00:00Z'), // before
      msg(OTHER, '2026-01-01T14:00:00Z'), // after
    ]
    expect(isChannelUnread(messages, '2026-01-01T12:00:00Z', ME)).toBe(true)
  })
})
