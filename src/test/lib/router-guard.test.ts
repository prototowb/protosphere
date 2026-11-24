import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { RouteLocationNormalized } from 'vue-router'
import { authGuard } from '@/router'
import { useAuthStore } from '@/stores/auth'

function route(name: string, query: Record<string, string> = {}, fullPath = '/'): RouteLocationNormalized {
  return { name, query, fullPath } as unknown as RouteLocationNormalized
}

describe('router auth guard', () => {
  const originalLocation = window.location
  let assign: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().loading = false
    assign = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, assign },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true })
  })

  function signIn() {
    useAuthStore().setSession({ user: { id: 'u1', email: 'member@example.test' }, access_token: 't' })
  }

  it('sends a signed-out visitor to /login with the page as redirect', () => {
    expect(authGuard(route('settings', {}, '/settings'))).toEqual({ name: 'login', query: { redirect: '/settings' } })
  })

  it('sends a signed-in visitor of /login to an in-app redirect', () => {
    signIn()
    expect(authGuard(route('login', { redirect: '/spaces/s1/c1' }))).toBe('/spaces/s1/c1')
  })

  it('sends a signed-in visitor of /login to a sibling app with a full navigation', () => {
    signIn()
    expect(authGuard(route('login', { redirect: 'https://typescript.protocode.xyz/' }))).toBe(false)
    expect(assign).toHaveBeenCalledExactlyOnceWith('https://typescript.protocode.xyz/')
  })

  it.each(['https://protocode.xyz.evil.com/', '//evil.com', '/\\evil.com'])(
    'sends a signed-in visitor of /login to the default page for %s',
    (redirect) => {
      signIn()
      expect(authGuard(route('login', { redirect }))).toBe('/channels/@me')
      expect(assign).not.toHaveBeenCalled()
    },
  )

  it('sends a signed-in visitor of other public pages to the default page', () => {
    signIn()
    expect(authGuard(route('register', { redirect: '/spaces/s1/c1' }))).toEqual({ name: 'dms' })
  })
})
