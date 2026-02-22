import { computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { useRolesStore } from '@/stores/roles'
import { useAuthStore } from '@/stores/auth'
import {
  hasPermission,
  computePermissions,
  deserializePermissions,
  legacyRoleToPermissions,
  type PermissionBits,
} from '@/lib/permissions'

/**
 * Provides permission checks for the current user in a given space.
 *
 * @param serverId    - reactive ref to the current server/space ID
 * @param memberRole  - optional legacy role string (fallback when no custom roles assigned)
 */
export function usePermissions(
  serverId: Ref<string | undefined>,
  memberRole?: Ref<string>,
) {
  const rolesStore = useRolesStore()
  const authStore = useAuthStore()

  const resolvedPermissions = computed((): PermissionBits => {
    const uid = authStore.user?.id
    if (!uid || !serverId.value) return 0n

    const userRoles = rolesStore.getUserRoles(serverId.value, uid)
    if (userRoles.length > 0) {
      return computePermissions(userRoles.map((r) => deserializePermissions(r.permissions)))
    }

    // Fallback to legacy role string when no custom roles are loaded yet
    if (memberRole?.value) {
      return legacyRoleToPermissions(memberRole.value)
    }

    return 0n
  })

  /**
   * Returns a reactive computed ref that is true when the current user
   * has the given permission. Use this in templates and for reactive derivations.
   */
  function can(permission: PermissionBits): ComputedRef<boolean> {
    return computed(() => hasPermission(resolvedPermissions.value, permission))
  }

  /**
   * Synchronous, non-reactive check. Useful inside event handlers.
   */
  function check(permission: PermissionBits): boolean {
    return hasPermission(resolvedPermissions.value, permission)
  }

  return { can, check, resolvedPermissions }
}
