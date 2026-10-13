import { canActOnUser, canGrantUserRole } from '@/core/lib/auth/assignable-roles'

describe('canActOnUser', () => {
  // The developer role ranks above superadmin: only a developer acts on a developer or a superadmin.
  it.each([
    ['developer', 'developer', true],
    ['developer', 'superadmin', true],
    ['developer', 'member', true],
    ['developer', 'suspended', true],
    ['superadmin', 'developer', false],
    ['superadmin', 'superadmin', false],
    ['superadmin', 'member', true],
    ['superadmin', 'suspended', true],
    ['member', 'developer', false],
    ['member', 'superadmin', false],
    [undefined, 'superadmin', false],
    [null, 'developer', false],
  ] as const)('a %s acting on a %s: %s', (caller, target, allowed) => {
    expect(canActOnUser(caller, target)).toBe(allowed)
  })
})

describe('canGrantUserRole', () => {
  it('grants member to anyone and developer only to a developer', () => {
    expect(canGrantUserRole('superadmin', 'member')).toBe(true)
    expect(canGrantUserRole('superadmin', 'developer')).toBe(false)
    expect(canGrantUserRole('developer', 'developer')).toBe(true)
    expect(canGrantUserRole('developer', 'superadmin')).toBe(false)
  })
})
