/**
 * Audit logging for the generic entity routes (#105).
 *
 * `logApiUsage` (lib/api/helpers.ts) is hard-typed to `ApiKeyAuth` and is
 * only triggered by the legacy `withApiLogging` wrapper, whose header-based
 * `getApiAuth` never sees the dual-auth flow the generic handlers use — so
 * neither session nor API-key activity on `/api/v1/[entity]` was ever
 * written to `api_audit_log`.
 *
 * This module accepts the real `DualAuthResult` the handlers already hold and
 * writes one row per REQUEST WITH AN IDENTIFIABLE PRINCIPAL (`apiKeyId` is
 * NULL for sessions; migration 025 dropped the NOT NULL) — a real session or
 * a real API key, whether the request was ultimately allowed or denied for
 * scope/permission reasons (#128). A request with no usable credential at all
 * (anonymous, missing, or invalid) is still never logged: there is no "who"
 * to attribute it to, and logging it would mostly capture bot/scanner noise
 * rather than anything actionable. It is invoked fire-and-forget from
 * `runWithAuditLog` in generic-handler.ts, so a logging failure can never turn
 * a successful response into an error.
 *
 * The request body is deliberately NOT stored: entity payloads routinely
 * carry personal data, and endpoint + method + status already identify what
 * was touched (the record id is part of the path for read/update/delete).
 */

import type { NextRequest } from 'next/server'
import { mutateWithRLS } from '../../db'
import type { DualAuthResult } from '../auth/dual-auth'

/**
 * Mutable slot a handler fills in once it has authenticated the request, so
 * the wrapper can attribute the response to a user / API key.
 */
export interface AuditContext {
  auth: DualAuthResult | null
}

export async function logGenericHandlerUsage(
  auth: DualAuthResult | null,
  request: NextRequest,
  statusCode: number,
  responseTime?: number
): Promise<void> {
  // Requests with no identifiable principal (public reads, missing/invalid
  // credentials) have nothing to attribute the row to — "userId" is NOT NULL
  // and that is intentional. This is deliberately NOT gated on `auth.success`:
  // a valid API key rejected for insufficient scope (#93's fail-closed
  // enforcement) still carries a real `user` (see the scope-failure branch in
  // authenticateRequest, dual-auth.ts) and #128 wants that denial logged too.
  const userId = auth?.user?.id
  if (!userId) return

  const apiKeyId = auth?.type === 'api-key' ? auth.keyId ?? null : null

  try {
    const endpoint = request.nextUrl.pathname
    const method = request.method
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent')

    await mutateWithRLS(
      `INSERT INTO "api_audit_log"
       ("apiKeyId", "userId", endpoint, method, "statusCode", "ipAddress", "userAgent", "requestBody", "responseTime")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        apiKeyId,
        userId,
        endpoint,
        method,
        statusCode,
        ipAddress,
        userAgent,
        null,
        typeof responseTime === 'number' ? Math.round(responseTime) : null,
      ],
      userId
    )
  } catch (error) {
    // Never break the response; never fail silently either.
    console.error('[generic-handler:audit] failed to write api_audit_log entry:', error)
  }
}
