import { backend } from '@/lib/backend'
import { useAuthStore } from '@/stores/auth'
import { useServersStore } from '@/stores/servers'

export function useServers() {
  const authStore = useAuthStore()
  const serversStore = useServersStore()

  async function fetchServers() {
    if (!authStore.user?.id) return
    serversStore.servers = await backend.servers.list(authStore.user.id)
  }

  async function createServer(name: string, description?: string) {
    if (!authStore.user?.id) return
    const server = await backend.servers.create({ name, description }, authStore.user.id)
    serversStore.servers.push(server)
    return server
  }

  async function updateServer(id: string, updates: { name?: string; description?: string; icon_url?: string | null; is_public?: boolean }) {
    const server = await backend.servers.update(id, updates)
    const idx = serversStore.servers.findIndex((s) => s.id === id)
    if (idx !== -1) serversStore.servers[idx] = server
    return server
  }

  async function deleteServer(id: string) {
    await backend.servers.delete(id)
    serversStore.servers = serversStore.servers.filter((s) => s.id !== id)
    if (serversStore.activeServerId === id) {
      serversStore.activeServerId = null
    }
  }

  async function joinServer(inviteCode: string) {
    if (!authStore.user?.id) return
    const server = await backend.servers.getByInviteCode(inviteCode)
    await backend.members.join(server.id, authStore.user.id)
    if (!serversStore.servers.some((s) => s.id === server.id)) {
      serversStore.servers.push(server)
    }
    return server
  }

  async function leaveServer(serverId: string) {
    if (!authStore.user?.id) return
    await backend.members.leave(serverId, authStore.user.id)
    serversStore.servers = serversStore.servers.filter((s) => s.id !== serverId)
    if (serversStore.activeServerId === serverId) {
      serversStore.activeServerId = null
    }
  }

  async function kickMember(serverId: string, userId: string) {
    await backend.members.leave(serverId, userId)
  }

  async function banMember(serverId: string, userId: string, reason?: string) {
    if (!authStore.user?.id) return
    await backend.bans.add(serverId, userId, authStore.user.id, reason)
  }

  async function unbanMember(serverId: string, userId: string) {
    await backend.bans.remove(serverId, userId)
  }

  async function regenerateInviteCode(serverId: string) {
    return await backend.servers.regenerateInviteCode(serverId)
  }

  return {
    fetchServers,
    createServer,
    updateServer,
    deleteServer,
    joinServer,
    leaveServer,
    kickMember,
    banMember,
    unbanMember,
    regenerateInviteCode,
  }
}
