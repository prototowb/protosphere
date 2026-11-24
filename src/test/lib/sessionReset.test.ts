import { describe, it, expect, vi } from 'vitest'
import { resetAppToLogin } from '@/lib/sessionReset'

function fakeLocation(pathname: string, search: string) {
  return { pathname, search, assign: vi.fn() }
}

describe('resetAppToLogin', () => {
  it('goes to a bare /login from any other page', () => {
    const loc = fakeLocation('/channels/@me', '?tab=1')
    resetAppToLogin(loc)
    expect(loc.assign).toHaveBeenCalledWith('/login')
  })

  it('keeps the query string when already on /login', () => {
    const search = '?redirect=https%3A%2F%2Ftypescript.protocode.xyz%2Fauth'
    const loc = fakeLocation('/login', search)
    resetAppToLogin(loc)
    expect(loc.assign).toHaveBeenCalledWith(`/login${search}`)
  })

  it('goes to a bare /login when /login has no query', () => {
    const loc = fakeLocation('/login', '')
    resetAppToLogin(loc)
    expect(loc.assign).toHaveBeenCalledWith('/login')
  })
})
