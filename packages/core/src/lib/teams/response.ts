/**
 * The columns the team routes return (#564). Listed, not `t.*`: a column added to `teams` later reaches a
 * response only when it is added here. `metadata` is one of them but is kept for whoever can edit the team.
 */
import { hasTeamPermission } from '../permissions/app-role-bypass'
import type { Permission } from '../permissions/types'

/** SQL select list for a `teams` row aliased `t`. */
export const TEAM_COLUMNS_SQL =
  't.id, t.name, t.slug, t.description, t."ownerId", t."avatarUrl", t."isGlobal", t.settings, t.metadata, ' +
  't."createdAt", t."updatedAt", t."deletedAt"'

/** Whether a member sees `metadata`: the check PATCH /api/v1/teams/:teamId makes (`team.edit`). */
export function canSeeTeamMetadata(appRole: string | null | undefined, teamRole: string | null | undefined): boolean {
  return hasTeamPermission(appRole, teamRole, 'team.edit' as Permission)
}

/** The row without its `metadata` key unless `allowed`. */
export function withTeamMetadata<T extends { metadata?: unknown }>(row: T, allowed: boolean): T {
  if (allowed) return row
  const { metadata: _omitted, ...rest } = row
  return rest as T
}
