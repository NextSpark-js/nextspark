/**
 * MCP audit trail.
 *
 * Every MCP tool call is recorded here so destructive actions by an
 * autonomous agent are at least reconstructable — same insert shape as
 * `logApiUsage` (packages/core/src/lib/api/helpers.ts), including passing the
 * caller's userId as RLS context.
 *
 * Since #105 the generic entity handlers also write their own row per
 * request (endpoint `/api/v1/...`, see lib/api/entity/audit-log.ts), so an
 * MCP tool call produces two rows: this one (`mcp:<tool>`, with the tool
 * arguments) and the underlying API call's. They are complementary, not
 * duplicates — this row carries what the agent asked for, the other what
 * the API answered.
 *
 * Note for operators: revoking an API key can take up to 5 minutes to become
 * effective (core apiKeyCache TTL) — the audit log covers that window.
 */

import { mutateWithRLS } from '../db'
import type { AuditEntry } from './types'

const MAX_SUMMARY_LENGTH = 4000

export async function auditToolCall(entry: AuditEntry): Promise<void> {
  if (!entry.apiKeyId && !entry.oauth) {
    // The MCP endpoint accepts an API key or an OAuth access token, so this should not
    // happen; never drop the trace silently if it does.
    console.warn('[mcp:audit] tool call without apiKeyId or OAuth client — skipping DB audit', {
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
    args: truncate(redactSecrets(entry.requestSummary) as Record<string, unknown>),
    // A call refused before it ran: what it needed and the credential did not have
    ...(entry.missingScopes ? { refused: 'insufficient_scope', missingScopes: entry.missingScopes } : {}),
    // An OAuth call has no api_key row: the client and the token's id identify the credential
    ...(entry.oauth ? { credential: 'oauth', oauthClientId: entry.oauth.clientId, oauthTokenId: entry.oauth.tokenId ?? null } : {}),
  }

  try {
    await mutateWithRLS(
      `INSERT INTO "api_audit_log"
       ("apiKeyId", "userId", endpoint, method, "statusCode", "ipAddress", "userAgent", "requestBody", "responseTime")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entry.apiKeyId ?? null,
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

// Words that name a secret wherever they appear in a key
const SECRET_WORDS = new Set(['password', 'passwd', 'passphrase', 'secret', 'secrets', 'authorization', 'credential', 'credentials', 'bearer', 'otp', 'pin', 'cvv', 'cvc', 'ssn'])
// `key` and `token` name a secret by their place: `apiKey`, `privateKey`, `accessToken`, `token`, but not
// `tokenCount` or `keyResults`
const KEY_QUALIFIERS = new Set(['api', 'private', 'access', 'secret', 'signing', 'encryption', 'auth', 'session'])
const AFTER_TOKEN = new Set(['value', 'hash', 'secret'])

/** `accessToken`, `access_token` and `access-token` as their words: access, token. */
function wordsOf(key: string): string[] {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

/** Whether a key names a secret, by its words: `password`, `clientSecret`, `apiKey`, `refresh_token`; not `tokenCount` or `secretaryName`. */
export function namesSecret(key: string): boolean {
  const words = wordsOf(key)
  return words.some((word, index) => {
    if (SECRET_WORDS.has(word)) return true
    const next = words[index + 1]
    if (word === 'token' || word === 'tokens') return next === undefined || AFTER_TOKEN.has(next)
    if (word === 'key') return index > 0 && KEY_QUALIFIERS.has(words[index - 1])
    return false
  })
}

/**
 * The arguments with the value of every key that names a secret replaced, at any depth: the audit trail is read by
 * people who should not learn a password or a token from it.
 */
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, inner]) => [
      key,
      namesSecret(key) && inner !== null && inner !== undefined ? '[redacted]' : redactSecrets(inner),
    ])
  )
}

function truncate(args: Record<string, unknown>): Record<string, unknown> {
  const json = JSON.stringify(args)
  if (json.length <= MAX_SUMMARY_LENGTH) return args
  return { truncated: true, preview: json.slice(0, MAX_SUMMARY_LENGTH) }
}
