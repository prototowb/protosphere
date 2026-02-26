import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Role } from '@/lib/types'

export const useRolesStore = defineStore('roles', () => {
  // roles indexed by serverId
  const rolesByServer = ref<Record<string, Role[]>>({})

  // user's roles indexed by `${serverId}:${userId}`
  const userRolesByKey = ref<Record<string, Role[]>>({})

  function setServerRoles(serverId: string, roles: Role[]) {
    rolesByServer.value[serverId] = roles
  }

  function setUserRoles(serverId: string, userId: string, roles: Role[]) {
    userRolesByKey.value[`${serverId}:${userId}`] = roles
  }

  function getServerRoles(serverId: string): Role[] {
    return rolesByServer.value[serverId] ?? []
  }

  function getUserRoles(serverId: string, userId: string): Role[] {
    return userRolesByKey.value[`${serverId}:${userId}`] ?? []
  }

  function clearServer(serverId: string) {
    delete rolesByServer.value[serverId]
    for (const key of Object.keys(userRolesByKey.value)) {
      if (key.startsWith(`${serverId}:`)) {
        delete userRolesByKey.value[key]
      }
    }
  }

  return {
    rolesByServer,
    userRolesByKey,
    setServerRoles,
    setUserRoles,
    getServerRoles,
    getUserRoles,
    clearServer,
  }
})
