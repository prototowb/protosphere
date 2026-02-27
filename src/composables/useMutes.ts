import { backend } from '@/lib/backend'
import { useAuthStore } from '@/stores/auth'
import { useMutesStore } from '@/stores/mutes'

export function useMutes() {
  const authStore = useAuthStore()
  const mutesStore = useMutesStore()

  async function fetchMutes(serverId: string) {
    const enriched = await backend.mutes.list(serverId)
    // Store just the plain Mute data (strip joined profile fields)
    mutesStore.setMutes(serverId, enriched.map((m) => ({
      server_id: m.server_id,
      user_id: m.user_id,
      muted_by: m.muted_by,
      reason: m.reason,
      expires_at: m.expires_at,
      created_at: m.created_at,
    })))
    return enriched
  }

  async function muteMember(serverId: string, userId: string, reason = '', expiresAt: string | null = null) {
    if (!authStore.user?.id) return
    const mute = await backend.mutes.add(serverId, userId, authStore.user.id, reason, expiresAt)
    mutesStore.addMute(mute)
    backend.audit_log.log(serverId, authStore.user.id, 'mute.add', 'member', userId, { reason, expires_at: expiresAt }).catch(() => {})
    return mute
  }

  async function unmuteMember(serverId: string, userId: string) {
    if (!authStore.user?.id) return
    await backend.mutes.remove(serverId, userId)
    mutesStore.removeMute(serverId, userId)
    backend.audit_log.log(serverId, authStore.user.id, 'mute.remove', 'member', userId).catch(() => {})
  }

  async function checkMuted(serverId: string, userId: string) {
    return backend.mutes.check(serverId, userId)
  }

  return { fetchMutes, muteMember, unmuteMember, checkMuted }
}
