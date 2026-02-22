// Permission bitfield constants and helpers for Protosphere's role system.
// All values are BigInt to safely handle bits beyond JS's 32-bit integer operations.

export const Permission = {
  // ── Space management ─────────────────────────────────────
  MANAGE_SPACE:       1n << 0n,   // Edit space name, icon, settings
  MANAGE_ROLES:       1n << 1n,   // Create/edit/delete roles; assign roles to members
  MANAGE_INVITES:     1n << 2n,   // Create and revoke invite links
  VIEW_AUDIT_LOG:     1n << 3n,   // Read audit log entries

  // ── Channel management ───────────────────────────────────
  VIEW_CHANNEL:       1n << 8n,   // See and read a channel
  MANAGE_CHANNELS:    1n << 9n,   // Create, edit, delete channels
  MANAGE_CATEGORIES:  1n << 10n,  // Create, edit, delete categories

  // ── Messaging ────────────────────────────────────────────
  SEND_MESSAGES:      1n << 16n,  // Post messages in text channels
  ATTACH_FILES:       1n << 17n,  // Upload files and images
  EMBED_LINKS:        1n << 18n,  // Allow link previews
  MENTION_EVERYONE:   1n << 19n,  // Use @everyone / @here
  MANAGE_MESSAGES:    1n << 20n,  // Delete others' messages; pin/unpin
  ADD_REACTIONS:      1n << 21n,  // Add emoji reactions

  // ── Moderation ───────────────────────────────────────────
  KICK_MEMBERS:       1n << 24n,  // Remove members from the space
  BAN_MEMBERS:        1n << 25n,  // Permanently ban members
  MUTE_MEMBERS:       1n << 26n,  // Silence members (prevent messaging)
  MANAGE_BANS:        1n << 27n,  // View and revoke bans

  // ── Profile ──────────────────────────────────────────────
  CHANGE_NICKNAME:    1n << 32n,  // Change own nickname in the space
  MANAGE_NICKNAMES:   1n << 33n,  // Change others' nicknames

  // ── Super ────────────────────────────────────────────────
  ADMINISTRATOR:      1n << 40n,  // Bypasses all permission checks
} as const

export type PermissionKey = keyof typeof Permission
export type PermissionBits = bigint

// ── Role presets ──────────────────────────────────────────────────────────────

const ADMIN_PERMISSIONS: PermissionBits =
  Permission.MANAGE_SPACE |
  Permission.MANAGE_ROLES |
  Permission.MANAGE_INVITES |
  Permission.VIEW_AUDIT_LOG |
  Permission.VIEW_CHANNEL |
  Permission.MANAGE_CHANNELS |
  Permission.MANAGE_CATEGORIES |
  Permission.SEND_MESSAGES |
  Permission.ATTACH_FILES |
  Permission.EMBED_LINKS |
  Permission.MENTION_EVERYONE |
  Permission.MANAGE_MESSAGES |
  Permission.ADD_REACTIONS |
  Permission.KICK_MEMBERS |
  Permission.BAN_MEMBERS |
  Permission.MUTE_MEMBERS |
  Permission.MANAGE_BANS |
  Permission.CHANGE_NICKNAME |
  Permission.MANAGE_NICKNAMES

const MODERATOR_PERMISSIONS: PermissionBits =
  Permission.VIEW_AUDIT_LOG |
  Permission.VIEW_CHANNEL |
  Permission.SEND_MESSAGES |
  Permission.ATTACH_FILES |
  Permission.EMBED_LINKS |
  Permission.MANAGE_MESSAGES |
  Permission.ADD_REACTIONS |
  Permission.KICK_MEMBERS |
  Permission.MUTE_MEMBERS |
  Permission.CHANGE_NICKNAME

const MEMBER_PERMISSIONS: PermissionBits =
  Permission.VIEW_CHANNEL |
  Permission.SEND_MESSAGES |
  Permission.ATTACH_FILES |
  Permission.EMBED_LINKS |
  Permission.ADD_REACTIONS |
  Permission.CHANGE_NICKNAME

export const PermissionPresets = {
  ADMINISTRATOR: Permission.ADMINISTRATOR,
  ADMIN: ADMIN_PERMISSIONS,
  MODERATOR: MODERATOR_PERMISSIONS,
  MEMBER: MEMBER_PERMISSIONS,
} as const

// ── Core helpers ─────────────────────────────────────────────────────────────

/** Returns true if `resolved` includes `permission`. ADMINISTRATOR bypasses all checks. */
export function hasPermission(resolved: PermissionBits, permission: PermissionBits): boolean {
  if ((resolved & Permission.ADMINISTRATOR) !== 0n) return true
  return (resolved & permission) !== 0n
}

/** Merge multiple role permission bitfields into one resolved value (OR all bits). */
export function mergePermissions(roleBits: PermissionBits[]): PermissionBits {
  return roleBits.reduce((acc, bits) => acc | bits, 0n)
}

/**
 * Apply a channel-level override on top of a base permission set.
 * Deny bits are cleared first, then allow bits are set.
 * ADMINISTRATOR flag bypasses channel overrides.
 */
export function applyChannelOverride(
  base: PermissionBits,
  allow: PermissionBits,
  deny: PermissionBits,
): PermissionBits {
  if ((base & Permission.ADMINISTRATOR) !== 0n) return base
  return (base & ~deny) | allow
}

/**
 * Compute effective permissions from a user's roles and optional channel overrides.
 * @param rolesBits - permission bigints from each of the user's roles
 * @param overrides - channel-level { allow, deny } pairs matching the user's roles
 */
export function computePermissions(
  rolesBits: PermissionBits[],
  overrides: { allow: PermissionBits; deny: PermissionBits }[] = [],
): PermissionBits {
  const base = mergePermissions(rolesBits)
  if ((base & Permission.ADMINISTRATOR) !== 0n) return base
  let result = base
  for (const ov of overrides) {
    result = applyChannelOverride(result, ov.allow, ov.deny)
  }
  return result
}

/** Serialize a permission bigint to a decimal string for DB storage. */
export function serializePermissions(bits: PermissionBits): string {
  return bits.toString()
}

/** Deserialize a permission string or number from the DB back to bigint. */
export function deserializePermissions(value: string | number): PermissionBits {
  return BigInt(value)
}

/**
 * Map a legacy MemberRole string to a permission bitfield.
 * Used as a fallback when a user has no custom roles assigned yet.
 */
export function legacyRoleToPermissions(role: string): PermissionBits {
  switch (role) {
    case 'owner':     return Permission.ADMINISTRATOR
    case 'admin':     return ADMIN_PERMISSIONS
    case 'moderator': return MODERATOR_PERMISSIONS
    default:          return MEMBER_PERMISSIONS
  }
}
