import type { Mute } from '@/lib/types'

/** Returns true if a mute record is currently in effect (not expired). */
export function isMuteActive(mute: Mute): boolean {
  if (mute.expires_at && new Date(mute.expires_at) <= new Date()) return false
  return true
}
