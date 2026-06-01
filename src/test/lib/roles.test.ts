import { describe, it, expect } from 'vitest'
import { roleUpdateAuditAction } from '@/lib/roles'

describe('roleUpdateAuditAction', () => {
  it('returns "role.permissions_changed" when permissions changes', () => {
    expect(roleUpdateAuditAction({ permissions: '42' }, '0')).toBe('role.permissions_changed')
  })

  it('returns "role.update" when permissions are unchanged', () => {
    expect(roleUpdateAuditAction({ permissions: '42' }, '42')).toBe('role.update')
  })

  it('returns "role.update" when permissions field is not in updates', () => {
    expect(roleUpdateAuditAction({ name: 'Moderator' }, '42')).toBe('role.update')
  })

  it('returns "role.permissions_changed" when old permissions is undefined and new value is set', () => {
    expect(roleUpdateAuditAction({ permissions: '10' }, undefined)).toBe('role.permissions_changed')
  })

  it('returns "role.update" for a non-permissions update with no previous permissions', () => {
    expect(roleUpdateAuditAction({ name: 'New Name' }, undefined)).toBe('role.update')
  })
})
