import { describe, it, expect } from 'vitest'
import { checkAutomod } from '@/lib/automod'
import type { AutomodRule } from '@/lib/types'

function makeRule(overrides: Partial<AutomodRule> & { rule_type: AutomodRule['rule_type']; config: Record<string, unknown> }): AutomodRule {
  return {
    id: '1',
    server_id: 's1',
    name: 'Test Rule',
    action: 'delete',
    enabled: true,
    created_at: '',
    ...overrides,
  }
}

describe('checkAutomod', () => {
  it('returns null when no rules', () => {
    expect(checkAutomod('hello', [])).toBeNull()
  })

  it('skips disabled rules', () => {
    const rule = makeRule({ rule_type: 'word_filter', config: { words: ['bad'] }, enabled: false })
    expect(checkAutomod('bad word', [rule])).toBeNull()
  })

  it('returns the first matching rule', () => {
    const r1 = makeRule({ id: '1', rule_type: 'word_filter', config: { words: ['first'] } })
    const r2 = makeRule({ id: '2', rule_type: 'word_filter', config: { words: ['second'] } })
    const result = checkAutomod('first and second', [r1, r2])
    expect(result?.rule.id).toBe('1')
  })

  describe('word_filter', () => {
    const rule = makeRule({ rule_type: 'word_filter', config: { words: ['bad', 'evil'] } })

    it('matches blocked word (case-insensitive)', () => {
      expect(checkAutomod('This is BAD content', [rule])).not.toBeNull()
    })

    it('matches blocked word as substring', () => {
      expect(checkAutomod('badly written', [rule])).not.toBeNull()
    })

    it('returns null for clean content', () => {
      expect(checkAutomod('hello world', [rule])).toBeNull()
    })

    it('includes blocked word in details', () => {
      const result = checkAutomod('evil message', [rule])
      expect(result?.details).toContain('evil')
    })

    it('returns null when words list is empty', () => {
      const empty = makeRule({ rule_type: 'word_filter', config: { words: [] } })
      expect(checkAutomod('anything', [empty])).toBeNull()
    })
  })

  describe('link_filter', () => {
    it('blocks any link when blocked_domains is empty', () => {
      const rule = makeRule({ rule_type: 'link_filter', config: { blocked_domains: [] } })
      expect(checkAutomod('visit https://example.com', [rule])).not.toBeNull()
    })

    it('blocks specific domain', () => {
      const rule = makeRule({ rule_type: 'link_filter', config: { blocked_domains: ['spam.com'] } })
      expect(checkAutomod('check https://spam.com/page', [rule])).not.toBeNull()
    })

    it('allows non-blocked domains', () => {
      const rule = makeRule({ rule_type: 'link_filter', config: { blocked_domains: ['spam.com'] } })
      expect(checkAutomod('visit https://safe.com', [rule])).toBeNull()
    })

    it('returns null when message has no URLs', () => {
      const rule = makeRule({ rule_type: 'link_filter', config: { blocked_domains: ['spam.com'] } })
      expect(checkAutomod('plain text message', [rule])).toBeNull()
    })

    it('domain match is case-insensitive', () => {
      const rule = makeRule({ rule_type: 'link_filter', config: { blocked_domains: ['Spam.com'] } })
      expect(checkAutomod('https://SPAM.COM/path', [rule])).not.toBeNull()
    })
  })

  describe('caps_filter', () => {
    it('triggers when uppercase ratio meets threshold', () => {
      const rule = makeRule({ rule_type: 'caps_filter', config: { threshold: 0.7 } })
      expect(checkAutomod('HELLO WORLD THIS IS SHOUTY', [rule])).not.toBeNull()
    })

    it('returns null when under threshold', () => {
      const rule = makeRule({ rule_type: 'caps_filter', config: { threshold: 0.7 } })
      expect(checkAutomod('Normal message with some Caps', [rule])).toBeNull()
    })

    it('skips short strings (under 10 letters)', () => {
      const rule = makeRule({ rule_type: 'caps_filter', config: { threshold: 0.5 } })
      expect(checkAutomod('ABCDE', [rule])).toBeNull()
    })

    it('uses default threshold of 0.7 when not configured', () => {
      const rule = makeRule({ rule_type: 'caps_filter', config: {} })
      expect(checkAutomod('AAAAAAAAAA', [rule])).not.toBeNull()
    })

    it('includes percentage in details', () => {
      const rule = makeRule({ rule_type: 'caps_filter', config: { threshold: 0.5 } })
      const result = checkAutomod('HELLO WORLD ARE YOU THERE', [rule])
      expect(result?.details).toContain('%')
    })
  })

  describe('spam_detect', () => {
    it('blocks messages exceeding max_length', () => {
      const rule = makeRule({ rule_type: 'spam_detect', config: { max_length: 10 } })
      expect(checkAutomod('This message is way too long', [rule])).not.toBeNull()
    })

    it('allows messages at max_length', () => {
      const rule = makeRule({ rule_type: 'spam_detect', config: { max_length: 20 } })
      expect(checkAutomod('short', [rule])).toBeNull()
    })

    it('blocks repeated characters exceeding max_repeat', () => {
      const rule = makeRule({ rule_type: 'spam_detect', config: { max_repeat: 3 } })
      expect(checkAutomod('heeeeello', [rule])).not.toBeNull()
    })

    it('allows repetition at or below max_repeat', () => {
      const rule = makeRule({ rule_type: 'spam_detect', config: { max_repeat: 5 } })
      expect(checkAutomod('heeello', [rule])).toBeNull()
    })

    it('uses defaults (max_repeat=5, max_length=2000) when not configured', () => {
      const rule = makeRule({ rule_type: 'spam_detect', config: {} })
      expect(checkAutomod('normal message', [rule])).toBeNull()
      expect(checkAutomod('aaaaaaa', [rule])).not.toBeNull()
    })
  })
})
