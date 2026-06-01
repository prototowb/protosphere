import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isMuteActive } from '@/lib/mutes'
import type { Mute } from '@/lib/types'

function mute(overrides: Partial<Mute> = {}): Mute {
  return {
    id: '1',
    server_id: 's1',
    user_id: 'u1',
    muted_by: 'admin',
    reason: null,
    expires_at: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('isMuteActive', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns true when expires_at is null (permanent mute)', () => {
    expect(isMuteActive(mute({ expires_at: null }))).toBe(true)
  })

  it('returns true when expires_at is in the future', () => {
    expect(isMuteActive(mute({ expires_at: '2026-12-31T00:00:00Z' }))).toBe(true)
  })

  it('returns false when expires_at is in the past', () => {
    expect(isMuteActive(mute({ expires_at: '2026-01-01T00:00:00Z' }))).toBe(false)
  })

  it('returns false when expires_at is exactly now', () => {
    expect(isMuteActive(mute({ expires_at: '2026-06-01T12:00:00Z' }))).toBe(false)
  })
})
