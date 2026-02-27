import { backend } from '@/lib/backend'
import { useAuthStore } from '@/stores/auth'
import { useRolesStore } from '@/stores/roles'
import type { Role } from '@/lib/types'

export function useRoles() {
  const authStore = useAuthStore()
  const store = useRolesStore()

  async function fetchServerRoles(serverId: string): Promise<Role[]> {
    const roles = await backend.roles.list(serverId)
    store.setServerRoles(serverId, roles)
    return roles
  }

  async function fetchUserRoles(serverId: string, userId: string): Promise<Role[]> {
    const roles = await backend.roles.listUserRoles(serverId, userId)
    store.setUserRoles(serverId, userId, roles)
    return roles
  }

  async function createRole(data: Parameters<typeof backend.roles.create>[0]): Promise<Role> {
    const role = await backend.roles.create(data)
    store.setServerRoles(data.server_id, [...store.getServerRoles(data.server_id), role])
    if (authStore.user?.id) {
      backend.audit_log.log(data.server_id, authStore.user.id, 'role.create', 'role', role.id, { name: role.name }).catch(() => {})
    }
    return role
  }

  async function updateRole(id: string, serverId: string, updates: Parameters<typeof backend.roles.update>[1]): Promise<Role> {
    const role = await backend.roles.update(id, updates)
    store.setServerRoles(serverId, store.getServerRoles(serverId).map((r) => (r.id === id ? role : r)))
    if (authStore.user?.id) {
      backend.audit_log.log(serverId, authStore.user.id, 'role.update', 'role', id, updates as Record<string, unknown>).catch(() => {})
    }
    return role
  }

  async function deleteRole(id: string, serverId: string): Promise<void> {
    await backend.roles.delete(id)
    store.setServerRoles(serverId, store.getServerRoles(serverId).filter((r) => r.id !== id))
    if (authStore.user?.id) {
      backend.audit_log.log(serverId, authStore.user.id, 'role.delete', 'role', id).catch(() => {})
    }
  }

  async function assignRole(userId: string, roleId: string, serverId: string): Promise<void> {
    await backend.roles.assignRole(userId, roleId)
    await fetchUserRoles(serverId, userId)
    if (authStore.user?.id) {
      backend.audit_log.log(serverId, authStore.user.id, 'role.assign', 'member', userId, { role_id: roleId }).catch(() => {})
    }
  }

  async function removeRole(userId: string, roleId: string, serverId: string): Promise<void> {
    await backend.roles.removeRole(userId, roleId)
    await fetchUserRoles(serverId, userId)
    if (authStore.user?.id) {
      backend.audit_log.log(serverId, authStore.user.id, 'role.remove', 'member', userId, { role_id: roleId }).catch(() => {})
    }
  }

  return {
    fetchServerRoles,
    fetchUserRoles,
    createRole,
    updateRole,
    deleteRole,
    assignRole,
    removeRole,
  }
}
