import { describe, it, expect } from 'vitest'
import {
  Permission,
  PermissionPresets,
  hasPermission,
  mergePermissions,
  applyChannelOverride,
  computePermissions,
  serializePermissions,
  deserializePermissions,
  legacyRoleToPermissions,
  resolveEffectivePermissions,
} from '@/lib/permissions'

describe('hasPermission', () => {
  it('returns true when the bit is set', () => {
    expect(hasPermission(Permission.SEND_MESSAGES, Permission.SEND_MESSAGES)).toBe(true)
  })

  it('returns false when the bit is not set', () => {
    expect(hasPermission(Permission.VIEW_CHANNEL, Permission.SEND_MESSAGES)).toBe(false)
  })

  it('returns true for any permission when ADMINISTRATOR bit is set', () => {
    expect(hasPermission(Permission.ADMINISTRATOR, Permission.BAN_MEMBERS)).toBe(true)
    expect(hasPermission(Permission.ADMINISTRATOR, Permission.MANAGE_CHANNELS)).toBe(true)
  })

  it('returns false for 0n permissions', () => {
    expect(hasPermission(0n, Permission.VIEW_CHANNEL)).toBe(false)
  })

  it('handles combined bits correctly', () => {
    const bits = Permission.SEND_MESSAGES | Permission.VIEW_CHANNEL
    expect(hasPermission(bits, Permission.SEND_MESSAGES)).toBe(true)
    expect(hasPermission(bits, Permission.BAN_MEMBERS)).toBe(false)
  })
})

describe('mergePermissions', () => {
  it('returns 0n for empty array', () => {
    expect(mergePermissions([])).toBe(0n)
  })

  it('ORs all bits together', () => {
    const merged = mergePermissions([Permission.SEND_MESSAGES, Permission.VIEW_CHANNEL])
    expect((merged & Permission.SEND_MESSAGES) !== 0n).toBe(true)
    expect((merged & Permission.VIEW_CHANNEL) !== 0n).toBe(true)
  })

  it('is idempotent for duplicate bits', () => {
    const a = mergePermissions([Permission.SEND_MESSAGES, Permission.SEND_MESSAGES])
    expect(a).toBe(Permission.SEND_MESSAGES)
  })
})

describe('applyChannelOverride', () => {
  it('deny bits are cleared from base', () => {
    const base = Permission.SEND_MESSAGES | Permission.VIEW_CHANNEL
    const result = applyChannelOverride(base, 0n, Permission.SEND_MESSAGES)
    expect((result & Permission.SEND_MESSAGES) !== 0n).toBe(false)
    expect((result & Permission.VIEW_CHANNEL) !== 0n).toBe(true)
  })

  it('allow bits are added to base', () => {
    const result = applyChannelOverride(0n, Permission.SEND_MESSAGES, 0n)
    expect((result & Permission.SEND_MESSAGES) !== 0n).toBe(true)
  })

  it('deny is applied before allow (allow wins over deny)', () => {
    const base = Permission.VIEW_CHANNEL
    const result = applyChannelOverride(base, Permission.SEND_MESSAGES, Permission.SEND_MESSAGES)
    expect((result & Permission.SEND_MESSAGES) !== 0n).toBe(true)
  })

  it('ADMINISTRATOR bypasses channel overrides', () => {
    const base = Permission.ADMINISTRATOR | Permission.SEND_MESSAGES
    const result = applyChannelOverride(base, 0n, Permission.SEND_MESSAGES)
    expect((result & Permission.SEND_MESSAGES) !== 0n).toBe(true)
  })
})

describe('computePermissions', () => {
  it('with no overrides returns merged roles', () => {
    const bits = computePermissions([Permission.SEND_MESSAGES, Permission.VIEW_CHANNEL])
    expect((bits & Permission.SEND_MESSAGES) !== 0n).toBe(true)
    expect((bits & Permission.VIEW_CHANNEL) !== 0n).toBe(true)
  })

  it('applies channel overrides in order', () => {
    const bits = computePermissions(
      [Permission.SEND_MESSAGES | Permission.VIEW_CHANNEL],
      [{ allow: 0n, deny: Permission.SEND_MESSAGES }],
    )
    expect((bits & Permission.SEND_MESSAGES) !== 0n).toBe(false)
  })

  it('ADMINISTRATOR skips all overrides', () => {
    const bits = computePermissions(
      [Permission.ADMINISTRATOR],
      [{ allow: 0n, deny: Permission.SEND_MESSAGES }],
    )
    expect(hasPermission(bits, Permission.SEND_MESSAGES)).toBe(true)
  })

  it('returns 0n for empty roles and no overrides', () => {
    expect(computePermissions([])).toBe(0n)
  })
})

describe('serializePermissions / deserializePermissions', () => {
  it('round-trips a simple value', () => {
    const bits = Permission.SEND_MESSAGES | Permission.VIEW_CHANNEL
    expect(deserializePermissions(serializePermissions(bits))).toBe(bits)
  })

  it('round-trips 0n', () => {
    expect(deserializePermissions(serializePermissions(0n))).toBe(0n)
  })

  it('accepts a number as input to deserialize', () => {
    expect(deserializePermissions(0)).toBe(0n)
  })

  it('serializes to a decimal string', () => {
    expect(serializePermissions(255n)).toBe('255')
  })
})

describe('legacyRoleToPermissions', () => {
  it('owner returns ADMINISTRATOR bit', () => {
    expect(legacyRoleToPermissions('owner')).toBe(Permission.ADMINISTRATOR)
  })

  it('admin returns ADMIN preset (no ADMINISTRATOR bypass bit)', () => {
    const bits = legacyRoleToPermissions('admin')
    expect((bits & Permission.ADMINISTRATOR) !== 0n).toBe(false)
    expect(hasPermission(bits, Permission.MANAGE_SPACE)).toBe(true)
  })

  it('moderator has moderation permissions', () => {
    const bits = legacyRoleToPermissions('moderator')
    expect(hasPermission(bits, Permission.KICK_MEMBERS)).toBe(true)
    expect(hasPermission(bits, Permission.MANAGE_SPACE)).toBe(false)
  })

  it('member has basic messaging permissions', () => {
    const bits = legacyRoleToPermissions('member')
    expect(hasPermission(bits, Permission.SEND_MESSAGES)).toBe(true)
    expect(hasPermission(bits, Permission.BAN_MEMBERS)).toBe(false)
  })

  it('unknown role falls back to member permissions', () => {
    const member = legacyRoleToPermissions('member')
    expect(legacyRoleToPermissions('guest')).toBe(member)
    expect(legacyRoleToPermissions('')).toBe(member)
  })
})

describe('resolveEffectivePermissions', () => {
  it('uses custom roles when present', () => {
    const memberBits = serializePermissions(Permission.SEND_MESSAGES | Permission.VIEW_CHANNEL)
    const bits = resolveEffectivePermissions([{ permissions: memberBits }])
    expect(hasPermission(bits, Permission.SEND_MESSAGES)).toBe(true)
  })

  it('falls back to legacyRole when no custom roles', () => {
    const bits = resolveEffectivePermissions([], 'owner')
    expect(hasPermission(bits, Permission.MANAGE_SPACE)).toBe(true)
  })

  it('returns 0n when no roles and no legacyRole', () => {
    expect(resolveEffectivePermissions([])).toBe(0n)
  })

  it('custom roles take priority over legacyRole', () => {
    const memberBits = serializePermissions(Permission.VIEW_CHANNEL)
    const bits = resolveEffectivePermissions([{ permissions: memberBits }], 'owner')
    expect(hasPermission(bits, Permission.MANAGE_SPACE)).toBe(false)
    expect(hasPermission(bits, Permission.VIEW_CHANNEL)).toBe(true)
  })
})

describe('PermissionPresets', () => {
  it('MEMBER cannot ban', () => {
    expect(hasPermission(PermissionPresets.MEMBER, Permission.BAN_MEMBERS)).toBe(false)
  })

  it('MODERATOR can kick but not ban', () => {
    expect(hasPermission(PermissionPresets.MODERATOR, Permission.KICK_MEMBERS)).toBe(true)
    expect(hasPermission(PermissionPresets.MODERATOR, Permission.BAN_MEMBERS)).toBe(false)
  })

  it('ADMIN can ban', () => {
    expect(hasPermission(PermissionPresets.ADMIN, Permission.BAN_MEMBERS)).toBe(true)
  })

  it('ADMINISTRATOR bypasses all checks', () => {
    expect(hasPermission(PermissionPresets.ADMINISTRATOR, Permission.MANAGE_SPACE)).toBe(true)
  })
})
