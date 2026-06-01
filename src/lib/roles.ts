import type { AuditLogAction, Role } from '@/lib/types'

/**
 * Pick the appropriate audit log action for a role update.
 * Permissions changes get a distinct action for clearer audit trails.
 */
export function roleUpdateAuditAction(
  updates: Partial<Pick<Role, 'permissions'>>,
  previousPermissions: string | undefined,
): AuditLogAction {
  if (updates.permissions !== undefined && updates.permissions !== previousPermissions) {
    return 'role.permissions_changed'
  }
  return 'role.update'
}
