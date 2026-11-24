import { describe, it, expect, beforeEach } from 'vitest'
import {
  DEFAULT_LOGIN_REDIRECT,
  PENDING_LOGIN_REDIRECT_TTL_MS,
  clearLoginRedirect,
  rememberLoginRedirect,
  resolveLoginRedirect,
  takeLoginRedirect,
} from '@/lib/loginRedirect'

const fallback = { href: DEFAULT_LOGIN_REDIRECT, external: false }
const prod = { allowLocalhost: false }

describe('resolveLoginRedirect', () => {
  it.each([
    '/channels/@me',
    '/spaces/s1/c1',
    '/u/alice?tab=pages#top',
    '/settings/profile',
  ])('accepts the in-app path %s', (path) => {
    expect(resolveLoginRedirect(path, prod)).toEqual({ href: path, external: false })
  })

  it.each([
    ['https://protocode.xyz/', 'https://protocode.xyz/'],
    ['https://typescript.protocode.xyz/lesson/3?x=1', 'https://typescript.protocode.xyz/lesson/3?x=1'],
    ['https://a.b.protocode.xyz', 'https://a.b.protocode.xyz/'],
    ['HTTPS://TypeScript.Protocode.XYZ/Path', 'https://typescript.protocode.xyz/Path'],
    ['https://chat.protocode.xyz:8443/x', 'https://chat.protocode.xyz:8443/x'],
  ])('accepts the protocode.xyz URL %s', (raw, href) => {
    expect(resolveLoginRedirect(raw, prod)).toEqual({ href, external: true })
  })

  it.each([
    'https://protocode.xyz.evil.com/',
    'https://PROTOCODE.XYZ.evil.com/',
    'https://evilprotocode.xyz/',
    'https://protocode.xyz.',
    'http://typescript.protocode.xyz/',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '//evil.com',
    '//evil.com/channels/@me',
    '/\\evil.com',
    '/\\/evil.com',
    '\\\\evil.com',
    '/\t/evil.com',
    '/\n/evil.com',
    ' /channels/@me',
    'https://user@evil.com',
    'https://user:pass@typescript.protocode.xyz/',
    'https://evil.com@protocode.xyz.evil.com/',
    'https://evil.com/?next=https://protocode.xyz',
    'channels/@me',
    'evil.com',
    'ftp://protocode.xyz/',
    'http://localhost:5173/',
    '',
  ])('falls back for %j', (raw) => {
    expect(resolveLoginRedirect(raw, prod)).toEqual(fallback)
  })

  it.each([undefined, null, 42, ['/channels/@me'], { href: '/x' }])('falls back for a non-string value %j', (raw) => {
    expect(resolveLoginRedirect(raw, prod)).toEqual(fallback)
  })

  it('falls back for an overlong value', () => {
    expect(resolveLoginRedirect(`/${'a'.repeat(3000)}`, prod)).toEqual(fallback)
  })

  describe('local development', () => {
    const dev = { allowLocalhost: true }

    it.each([
      'http://localhost:5173/learn',
      'http://127.0.0.1:4173/',
      'https://localhost/',
    ])('accepts %s', (raw) => {
      expect(resolveLoginRedirect(raw, dev).external).toBe(true)
    })

    it.each([
      'http://localhost.evil.com/',
      'http://127.0.0.1.evil.com/',
      'javascript:alert(1)',
      'http://user@localhost/',
    ])('still falls back for %s', (raw) => {
      expect(resolveLoginRedirect(raw, dev)).toEqual(fallback)
    })
  })
})

describe('pending login redirect (OAuth round trip)', () => {
  const NOW = Date.UTC(2026, 10, 24, 12, 0, 0)

  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('returns a remembered target once', () => {
    rememberLoginRedirect('https://typescript.protocode.xyz/lesson/3', NOW)

    expect(takeLoginRedirect(NOW + 1000)).toEqual({ href: 'https://typescript.protocode.xyz/lesson/3', external: true })
    expect(takeLoginRedirect(NOW + 2000)).toBeNull()
  })

  it('keeps in-app paths', () => {
    rememberLoginRedirect('/spaces/s1/c1', NOW)
    expect(takeLoginRedirect(NOW)).toEqual({ href: '/spaces/s1/c1', external: false })
  })

  it.each([undefined, '', '//evil.com', 'https://evil.com/'])('does not remember %j and clears an earlier target', (raw) => {
    rememberLoginRedirect('/spaces/s1/c1', NOW)
    rememberLoginRedirect(raw, NOW)
    expect(takeLoginRedirect(NOW)).toBeNull()
  })

  it('ignores an expired target', () => {
    rememberLoginRedirect('/spaces/s1/c1', NOW)
    expect(takeLoginRedirect(NOW + PENDING_LOGIN_REDIRECT_TTL_MS + 1)).toBeNull()
  })

  it('checks a stored target again before returning it', () => {
    window.sessionStorage.setItem('protosphere-login-redirect', JSON.stringify({ redirect: 'https://evil.com/', at: NOW }))
    expect(takeLoginRedirect(NOW)).toBeNull()
  })

  it.each(['not-json', '{}', '{"redirect":"/x"}', '{"redirect":"/x","at":"soon"}', 'null'])(
    'ignores a malformed stored value %s',
    (stored) => {
      window.sessionStorage.setItem('protosphere-login-redirect', stored)
      expect(() => takeLoginRedirect(NOW)).not.toThrow()
      expect(takeLoginRedirect(NOW)).toBeNull()
    },
  )

  it('clearLoginRedirect forgets the target', () => {
    rememberLoginRedirect('/spaces/s1/c1', NOW)
    clearLoginRedirect()
    expect(takeLoginRedirect(NOW)).toBeNull()
  })
})
