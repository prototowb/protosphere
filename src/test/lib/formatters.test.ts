import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { escapeHtml, isExpiringSoon, formatDate, formatTime, formatDateTime, formatDateShort, formatDateFull } from '@/lib/formatters'

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  it('escapes less-than', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
  })

  it('escapes greater-than', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b')
  })

  it('escapes all three in one string', () => {
    expect(escapeHtml('<a & b>')).toBe('&lt;a &amp; b&gt;')
  })

  it('returns plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })

  it('returns empty string unchanged', () => {
    expect(escapeHtml('')).toBe('')
  })
})

describe('isExpiringSoon', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns false for null', () => {
    expect(isExpiringSoon(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isExpiringSoon(undefined)).toBe(false)
  })

  it('returns true when expiry is within 12 hours', () => {
    const in6Hours = new Date('2026-01-15T18:00:00Z').toISOString()
    expect(isExpiringSoon(in6Hours)).toBe(true)
  })

  it('returns false when expiry is beyond 12 hours', () => {
    const in24Hours = new Date('2026-01-16T14:00:00Z').toISOString()
    expect(isExpiringSoon(in24Hours)).toBe(false)
  })

  it('returns true for already-expired dates', () => {
    const past = new Date('2026-01-14T12:00:00Z').toISOString()
    expect(isExpiringSoon(past)).toBe(true)
  })
})

describe('formatDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Today" for today\'s date', () => {
    expect(formatDate(new Date().toISOString())).toBe('Today')
  })

  it('returns "Yesterday" for yesterday\'s date', () => {
    const yesterday = new Date('2026-01-14T12:00:00.000Z').toISOString()
    expect(formatDate(yesterday)).toBe('Yesterday')
  })

  it('returns formatted date string for older dates', () => {
    const old = new Date('2025-06-01T12:00:00.000Z').toISOString()
    const result = formatDate(old)
    expect(result).not.toBe('Today')
    expect(result).not.toBe('Yesterday')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('formatTime', () => {
  it('returns a non-empty string for a valid ISO date', () => {
    const result = formatTime('2026-01-15T14:30:00Z')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('formatDateTime', () => {
  it('returns a string containing "at"', () => {
    const result = formatDateTime('2026-01-15T14:30:00Z')
    expect(result).toContain('at')
  })

  it('returns a non-empty string for a valid ISO date', () => {
    expect(formatDateTime('2026-01-15T14:30:00Z').length).toBeGreaterThan(0)
  })
})

describe('formatDateShort', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Today at ..." for today\'s date', () => {
    expect(formatDateShort(new Date().toISOString())).toContain('Today at')
  })

  it('returns a string with "at" for other dates', () => {
    const past = new Date('2025-06-01T12:00:00.000Z').toISOString()
    expect(formatDateShort(past)).toContain('at')
  })
})

describe('formatDateFull', () => {
  it('returns a non-empty string for a valid ISO date', () => {
    const result = formatDateFull('2026-01-15T14:30:00Z')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})
