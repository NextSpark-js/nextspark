/**
 * The owner role is the team's superuser by design: it receives every declared permission,
 * including one declared with `roles: []` (listed by no role). Documented in
 * docs/14-permissions/03-permission-service.md (#380).
 */

import { PermissionService } from '@/core/lib/services/permission.service'
import type { Permission } from '@/core/lib/permissions/types'

describe('PermissionService owner', () => {
  it('receives a permission declared with roles: [] while every other role is refused', () => {
    expect(PermissionService.isValid('posts.seal' as Permission)).toBe(true)
    expect(PermissionService.hasPermission('owner', 'posts.seal' as Permission)).toBe(true)
    expect(PermissionService.canDoAction('owner', 'posts.seal')).toBe(true)
    for (const role of ['admin', 'member', 'viewer']) {
      expect(PermissionService.hasPermission(role, 'posts.seal' as Permission)).toBe(false)
      expect(PermissionService.canDoAction(role, 'posts.seal')).toBe(false)
    }
  })

  it('hasPermission does not grant owner a permission nobody declared', () => {
    expect(PermissionService.hasPermission('owner', 'posts.undeclared' as Permission)).toBe(false)
  })
})
