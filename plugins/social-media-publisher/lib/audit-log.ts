/**
 * The plugin's audit trail: one row of "social_audit_logs" per action, written by the plugin's routes and read
 * through core's generic entity API (the audit-logs entity), which shows a team its own rows.
 */
import type { NextRequest } from 'next/server'
import { getRecordedClientIp } from '@nextsparkjs/core/lib/api/client-ip'
import { mutateWithRLS } from '@nextsparkjs/core/lib/db'

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
