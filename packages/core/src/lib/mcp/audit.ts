/**
 * MCP audit trail.
 *
 * The core's api_audit_log exists but the generic entity handlers never write
 * to it directly for in-process invocations (logApiUsage only runs inside
 * withApiAuth, which the MCP executor's synthesized requests don't go
 * through). Every MCP tool call is recorded here so destructive actions by an
 * autonomous agent are at least reconstructable — same insert shape as
 * `logApiUsage` (packages/core/src/lib/api/helpers.ts), including passing the
 * caller's userId as RLS context.
 *
 * Note for operators: revoking an API key can take up to 5 minutes to become
 * effective (core apiKeyCache TTL) — the audit log covers that window.
 */

import { mutateWithRLS } from '../db'
import type { AuditEntry } from './types'

const MAX_SUMMARY_LENGTH = 4000

export async function auditToolCall(entry: AuditEntry): Promise<void> {
  if (!entry.apiKeyId) {
    // The MCP endpoint only accepts api-key auth, so this should not happen;
    // never drop the trace silently if it does.
    console.warn('[mcp:audit] tool call without apiKeyId — skipping DB audit', {
      tool: entry.tool,
      userId: entry.userId,
    })
    return
  }

  const requestBody = {
    tool: entry.tool,
    entity: entry.entitySlug ?? null,
    operation: entry.operation ?? null,
    recordId: entry.recordId ?? null,
    teamId: entry.teamId,
    args: truncate(entry.requestSummary),
  }

  try {
    await mutateWithRLS(
      `INSERT INTO "api_audit_log"
       ("apiKeyId", "userId", endpoint, method, "statusCode", "ipAddress", "userAgent", "requestBody", "responseTime")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entry.apiKeyId,
        entry.userId,
        `mcp:${entry.tool}`,
        (entry.operation ?? 'workflow').toUpperCase(),
        entry.statusCode,
        'mcp',
        'mcp-client',
        JSON.stringify(requestBody),
        entry.responseTimeMs,
      ],
      entry.userId
    )
  } catch (error) {
    // Auditing must never break the tool call, but must never fail silently either.
    console.error('[mcp:audit] failed to write api_audit_log entry:', error)
  }
}

function truncate(args: Record<string, unknown>): Record<string, unknown> {
  const json = JSON.stringify(args)
  if (json.length <= MAX_SUMMARY_LENGTH) return args
  return { truncated: true, preview: json.slice(0, MAX_SUMMARY_LENGTH) }
}
