import { describe, it, expect, vi } from 'vitest'

// Mock markdown to avoid twemoji/emojiNames deps in unit tests
vi.mock('@/lib/markdown', () => ({
  renderMarkdown: (s: string) => s,
}))

import { renderMessage, renderWithMentions, extractMentionedUsernames } from '@/lib/mentions'

describe('extractMentionedUsernames', () => {
  it('returns empty array when no mentions', () => {
    expect(extractMentionedUsernames('hello world')).toEqual([])
  })

  it('extracts a single mention', () => {
    expect(extractMentionedUsernames('hello @alice')).toEqual(['alice'])
  })

  it('extracts multiple mentions', () => {
    expect(extractMentionedUsernames('@alice and @bob')).toEqual(['alice', 'bob'])
  })

  it('returns empty array for empty string', () => {
    expect(extractMentionedUsernames('')).toEqual([])
  })

  it('handles mention at start of string', () => {
    expect(extractMentionedUsernames('@charlie says hi')).toEqual(['charlie'])
  })

  it('strips the @ prefix from results', () => {
    const usernames = extractMentionedUsernames('@alice')
    expect(usernames[0]).not.toContain('@')
  })
})

describe('renderMessage', () => {
  it('wraps matching username in mention-me span', () => {
    const result = renderMessage('hi @alice', 'alice')
    expect(result).toContain('class="mention-me"')
    expect(result).toContain('@alice')
  })

  it('wraps non-matching username in mention span', () => {
    const result = renderMessage('hi @bob', 'alice')
    expect(result).toContain('class="mention"')
    expect(result).not.toContain('mention-me')
  })

  it('handles null myUsername (no self-highlight)', () => {
    const result = renderMessage('hi @alice', null)
    expect(result).toContain('class="mention"')
    expect(result).not.toContain('mention-me')
  })

  it('passes content through escapeHtml (escapes < and >)', () => {
    const result = renderMessage('<b>hi</b>', null)
    expect(result).toContain('&lt;')
    expect(result).toContain('&gt;')
  })

  it('handles content with no mentions', () => {
    const result = renderMessage('plain message', 'alice')
    expect(result).toBe('plain message')
  })
})

describe('renderWithMentions (legacy alias)', () => {
  it('is identical to renderMessage', () => {
    expect(renderWithMentions('hi @alice', 'alice')).toBe(renderMessage('hi @alice', 'alice'))
  })
})
