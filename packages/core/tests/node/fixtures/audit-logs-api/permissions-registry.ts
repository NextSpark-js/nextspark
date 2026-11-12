/**
 * The permissions of the audit-logs API test: the registration-gates stand-in, plus what a project's
 * permissions.config.ts declares for the plugin's entity (the plugin's docs suggest owner and admin). Owner holds every
 * declared permission (ALL_PERMISSIONS_SET), the other roles their own set.
 */
import { ALL_PERMISSIONS, ALL_PERMISSIONS_SET, PERMISSIONS_BY_ROLE } from '../registration-gates/permissions-registry'

export * from '../registration-gates/permissions-registry'

for (const permission of ['audit-logs.list', 'audit-logs.read']) {
  ALL_PERMISSIONS.push(permission)
  ALL_PERMISSIONS_SET.add(permission)
  PERMISSIONS_BY_ROLE.admin.add(permission)
}
