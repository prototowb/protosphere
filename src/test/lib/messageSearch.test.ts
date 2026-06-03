import { describe, it, expect } from 'vitest'
import { messageMatchesQuery } from '@/lib/messageSearch'

describe('messageMatchesQuery', () => {
  it('returns true for an exact match', () => {
    expect(messageMatchesQuery('hello world', 'hello world')).toBe(true)
  })

  it('returns true for a substring match', () => {
    expect(messageMatchesQuery('hello world', 'world')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(messageMatchesQuery('Hello World', 'hello')).toBe(true)
    expect(messageMatchesQuery('hello world', 'WORLD')).toBe(true)
  })

  it('returns false when query is not in content', () => {
    expect(messageMatchesQuery('hello world', 'missing')).toBe(false)
  })

  it('returns true for empty query (empty string is always included)', () => {
    expect(messageMatchesQuery('hello', '')).toBe(true)
  })

  it('returns true for empty content and empty query', () => {
    expect(messageMatchesQuery('', '')).toBe(true)
  })

  it('returns false for non-empty query in empty content', () => {
    expect(messageMatchesQuery('', 'something')).toBe(false)
  })
})
