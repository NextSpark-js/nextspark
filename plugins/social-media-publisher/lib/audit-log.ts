/**
 * The plugin's audit trail: one row of "social_audit_logs" per action, written by the plugin's routes and read
 * through core's generic entity API (the audit-logs entity), which shows a team its own rows.
 */
import type { NextRequest, NextResponse } from 'next/server'
import { resolveTeamContext, type DualAuthResult } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { getRecordedClientIp } from '@nextsparkjs/core/lib/api/client-ip'
import { mutateWithRLS } from '@nextsparkjs/core/lib/db'
import { TeamMemberService } from '@nextsparkjs/core/lib/services/team-member.service'

/** Roles row-level security lets write in any team (can_bypass_rls()). */
const BYPASS_ROLES = ['superadmin', 'developer']

/**
 * The team an audit row is written in, resolved before the route changes anything: the team the adapter gave for
 * the entity when the user may write there (a member of it, or a superadmin/developer), else the request's team
 * (`x-team-id`, the active team, the default team). An adapter team the user is not in would make the insert fail
 * row-level security after the action (a post already published), so it is not used. A NextResponse (400/403) when
 * the request has no team the user belongs to.
 */
export async function auditTeamId(
  request: NextRequest,
  authResult: DualAuthResult,
  entityTeamId?: string
): Promise<string | NextResponse> {
  const user = authResult.user!
  if (entityTeamId && (BYPASS_ROLES.includes(user.role) || await TeamMemberService.isMember(entityTeamId, user.id))) {
    return entityTeamId
  }
  return resolveTeamContext(request, authResult)
}

/** The actions the table's CHECK accepts (migration 002). */
export type AuditAction =
  | 'account_connected'
  | 'account_assigned'
  | 'account_disconnected'
  | 'post_published'
  | 'post_failed'
  | 'token_refreshed'

export interface AuditEntry {
  userId: string
  /** The team the action belongs to: the team of the entity the account is assigned to, else the request's team */
  teamId: string
  accountId: string | null
  action: AuditAction
  details: Record<string, unknown>
}

/** Writes the row as the user (row-level security checks that `teamId` is one of the user's teams). */
export async function recordAuditLog(request: NextRequest, entry: AuditEntry): Promise<void> {
  await mutateWithRLS(
    `INSERT INTO "social_audit_logs"
      ("userId", "teamId", "accountId", action, details, "ipAddress", "userAgent")
     VALUES ($1, $2, $3::uuid, $4, $5, $6, $7)`,
    [
      entry.userId,
      entry.teamId,
      entry.accountId,
      entry.action,
      JSON.stringify(entry.details),
      getRecordedClientIp(request.headers),
      request.headers.get('user-agent') || null,
    ],
    entry.userId
  )
}
