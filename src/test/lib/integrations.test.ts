import { describe, it, expect } from 'vitest'
import {
  assertIntegrationUrl,
  parseIntegrationPayload,
  isFieldVisibleTo,
  MAX_INTEGRATION_PAYLOAD_CHARS,
} from '@/lib/integrations'

describe('assertIntegrationUrl', () => {
  it.each(['https://api.example.com/data', 'http://localhost:54321/functions/v1/x', 'http://127.0.0.1:8080/'])(
    'allows %s',
    (url) => {
      expect(() => assertIntegrationUrl(url)).not.toThrow()
    },
  )

  it.each(['http://api.example.com/data', 'javascript:alert(1)', 'ftp://x/y', '/relative/path', 'not a url'])(
    'rejects %s',
    (url) => {
      expect(() => assertIntegrationUrl(url)).toThrow()
    },
  )
})

describe('parseIntegrationPayload', () => {
  it('accepts a { fields } envelope', () => {
    expect(parseIntegrationPayload('{"fields":{"xp":{"value":10}}}')).toEqual({ xp: { value: 10 } })
  })

  it('accepts a bare fields object', () => {
    expect(parseIntegrationPayload('{"xp":{"value":10,"label":"XP"}}')).toEqual({ xp: { value: 10, label: 'XP' } })
  })

  it('drops entries that are not { value } objects', () => {
    expect(parseIntegrationPayload('{"a":{"value":1},"b":2,"c":[1],"d":{"x":1}}')).toEqual({ a: { value: 1 } })
  })

  it('ignores prototype-polluting keys', () => {
    const out = parseIntegrationPayload('{"__proto__":{"value":1},"constructor":{"value":2},"ok":{"value":3}}')
    expect(Object.keys(out)).toEqual(['ok'])
    expect(({} as Record<string, unknown>).value).toBeUndefined()
  })

  it.each(['[1,2]', '"str"', '42', 'null', 'not json'])('rejects non-object body %s', (body) => {
    expect(() => parseIntegrationPayload(body)).toThrow()
  })

  it('rejects oversized payloads', () => {
    const big = JSON.stringify({ x: { value: 'a'.repeat(MAX_INTEGRATION_PAYLOAD_CHARS) } })
    expect(() => parseIntegrationPayload(big)).toThrow(/too large/)
  })
})

describe('isFieldVisibleTo', () => {
  it('shows public fields to everyone', () => {
    expect(isFieldVisibleTo('public', false)).toBe(true)
    expect(isFieldVisibleTo('public', true)).toBe(true)
  })

  it('shows private ("Only me") fields to the owner only', () => {
    expect(isFieldVisibleTo('private', true)).toBe(true)
    expect(isFieldVisibleTo('private', false)).toBe(false)
  })

  it('never shows hidden fields', () => {
    expect(isFieldVisibleTo('hidden', true)).toBe(false)
    expect(isFieldVisibleTo('hidden', false)).toBe(false)
  })
})
