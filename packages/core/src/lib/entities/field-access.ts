/**
 * Role-based field access (#325), shared by the generic REST handler (which the MCP tools also go through) and
 * GenericEntityService (server actions). An entity that declares neither `access.fieldVisibility` nor
 * `access.ownershipFilter.fieldGuards` never reaches the database from here.
 *
 * - `access.fieldVisibility: [{ roles, hideFields }]`: fields a team role does not get back in list, read, create and update responses
 * - `access.ownershipFilter.fieldGuards: [{ roles, denyFields }]`: fields a team role cannot send on create or update
 */

import { queryOneWithRLS } from '../db'
import type { EntityConfig } from './types'

/** Whether the entity declares a rule that depends on the caller's team role. */
export function hasRoleFieldRules(entityConfig: EntityConfig): boolean {
  return !!entityConfig.access?.fieldVisibility?.length || !!entityConfig.access?.ownershipFilter?.fieldGuards?.length
}

/** The caller's role in the team, only looked up when the entity declares a role-based field rule. */
export async function roleForFieldRules(entityConfig: EntityConfig, userId: string | null, teamId: string | null | undefined): Promise<string | null> {
  if (!userId || !teamId || !hasRoleFieldRules(entityConfig)) return null
  const row = await queryOneWithRLS<{ role: string }>(
    'SELECT role FROM "team_members" WHERE "teamId" = $1 AND "userId" = $2',
    [teamId, userId],
    userId
  )
  return row?.role ?? null
}

/** The fields `access.fieldVisibility` hides from `role` (empty without a role or a matching rule). */
export function hiddenFieldsForRole(entityConfig: EntityConfig, role: string | null): Set<string> {
  const hidden = new Set<string>()
  if (!role) return hidden
  for (const rule of entityConfig.access?.fieldVisibility ?? []) {
    if (rule.roles.includes(role)) rule.hideFields.forEach(field => hidden.add(field))
  }
  return hidden
}

/** The keys of a create or update body that `fieldGuards` do not allow `role` to send. */
export function deniedWriteFields(entityConfig: EntityConfig, role: string | null, body: Record<string, unknown>): string[] {
  if (!role) return []
  const denied: string[] = []
  for (const guard of entityConfig.access?.ownershipFilter?.fieldGuards ?? []) {
    if (guard.roles.includes(role)) denied.push(...guard.denyFields.filter(field => field in body && !denied.includes(field)))
  }
  return denied
}

/** `data` (one record or a list) without the hidden fields; the same object when nothing is hidden. */
export function omitHiddenFields<T>(data: T, hidden: Set<string>): T {
  if (hidden.size === 0 || !data || typeof data !== 'object') return data
  const omit = (item: unknown) => {
    if (!item || typeof item !== 'object') return item
    return Object.fromEntries(Object.entries(item).filter(([key]) => !hidden.has(key)))
  }
  return (Array.isArray(data) ? data.map(omit) : omit(data)) as T
}
