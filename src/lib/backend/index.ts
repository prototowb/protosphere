import type { Backend } from './types'

export const isLocalMode = !import.meta.env.VITE_SUPABASE_URL

let _backend: Backend

if (isLocalMode) {
  const { createLocalBackend } = await import('./local')
  _backend = createLocalBackend()
} else {
  const { createSupabaseBackend } = await import('./supabase-backend')
  _backend = createSupabaseBackend()
}

export const backend: Backend = _backend

export type { AuthUser, AuthSession, Backend } from './types'
