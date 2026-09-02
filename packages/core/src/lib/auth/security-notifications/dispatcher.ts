/**
 * Security-notifications dispatcher.
 *
 * Called from the Better Auth route handler AFTER the auth response has been
 * produced. It inspects the request path + the outgoing response, and — when a
 * security-relevant event succeeded — records login history and queues the
 * appropriate email via the `auth:security-notification` scheduled action.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️  CRITICAL FOOTGUN — read the user from the RESPONSE BODY, not the session.
 * ────────────────────────────────────────────────────────────────────────────
 * For a sign-in, the session does NOT exist on the INCOMING request: the session
 * cookie is only now being written, sitting in the OUTGOING `Set-Cookie` header.
 * Calling `auth.api.getSession({ headers: req.headers })` here would read the
 * incoming cookies, find none, and silently return null — so new-device emails
 * would NEVER fire. We therefore read the just-authenticated user from
 * `response.clone().json()` (Better Auth's sign-in/change-password responses
 * carry `{ user, token, ... }`).
 *
 * The ONE exception is `change-email`: that request is made by an ALREADY
 * authenticated user (its incoming cookie is valid) and its response body is
 * only `{ status: true }` — no user. There we DO read the session, to recover
 * the *old* address the notification must go to. That asymmetry is deliberate;
 * do not "simplify" it into a single getSession call.
 *
 * Everything here is best-effort: any failure is swallowed so a security email
 * problem can NEVER turn a successful auth response into a 500.
 */

import type { NextRequest, NextResponse } from 'next/server'
import { AUTH_CONFIG, I18N_CONFIG, APP_NAME } from '../../config'
import { queryWithRLS, mutateWithRLS } from '../../db'
import { scheduleAction, isActionRegistered } from '../../scheduled-actions'
import { registerSecurityNotificationAction } from '../../scheduled-actions/handlers/security-notification'
import { computeDeviceFingerprint, extractClientIp } from './device-fingerprint'
import type {
  SecurityEventType,
  SecurityNotificationActionPayload,
} from './types'

const ACTION_TYPE = 'auth:security-notification'

/** Response bodies from Better Auth carry the user like this on success. */
interface AuthResponseBody {
  user?: {
    id?: string
    email?: string
    name?: string
    firstName?: string
    language?: string
  }
}

function getPathname(req: NextRequest): string {
  // The auth route hands us `req.clone()`. On a cloned NextRequest (Next 15)
  // merely reading `nextUrl` throws ("Cannot create proxy with a non-object as
  // target or handler"), so it gets its own try: a throw here must fall back to
  // `req.url`, which clones do keep. Otherwise every event classified as ''
  // and the dispatcher silently did nothing in production (integration E2E).
  try {
    const pathname = req.nextUrl?.pathname
    if (pathname) return pathname
  } catch {
    // fall through to req.url
  }
  try {
    return new URL(req.url).pathname
  } catch {
    return ''
  }
}

/** 2xx? (only successful auth operations should notify). */
function isOk(response: Response): boolean {
  return response.status >= 200 && response.status < 300
}

function resolveAppName(): string {
  return process.env.NEXT_PUBLIC_APP_NAME || APP_NAME || 'Your App'
}

/**
 * Ensure the scheduled-action handler exists before we enqueue work for it.
 * The registry lives on globalThis and is shared with the cron processor in the
 * same server process, so registering here once is enough and idempotent.
 */
function ensureHandlerRegistered(): void {
  if (!isActionRegistered(ACTION_TYPE)) {
    registerSecurityNotificationAction()
  }
}

/** Queue one security email. Best-effort; throws are handled by the caller. */
async function queueNotification(
  userId: string,
  payload: Omit<SecurityNotificationActionPayload, 'entityId' | 'entityType'>,
): Promise<void> {
  if (!payload.to) return // no recipient → nothing to send
  ensureHandlerRegistered()
  await scheduleAction(ACTION_TYPE, {
    ...payload,
    // entityId+entityType drive the scheduler's dedup so a double-submit of the
    // same event for the same user within the dedup window collapses to one email.
    entityId: `${userId}:${payload.type}`,
    entityType: 'security-notification',
  } satisfies SecurityNotificationActionPayload)
}

/**
 * New-device login: record the login, decide if the fingerprint is new, and
 * (only if new) queue the alert.
 */
async function handleNewDeviceLogin(
  req: NextRequest,
  body: AuthResponseBody,
): Promise<void> {
  const user = body.user
  if (!user?.id) return

  const ip = extractClientIp(req.headers)
  const userAgent = req.headers.get('user-agent')
  const fingerprint = computeDeviceFingerprint(userAgent, ip)

  const ttlDays = AUTH_CONFIG.securityNotifications?.fingerprintTtlDays ?? null

  // Has this (user, fingerprint) been seen before (within TTL, if configured)?
  // Runs on the service pool (userId=null) — a system read, and login_events RLS
  // only exposes rows to their owner anyway.
  const params: unknown[] = [user.id, fingerprint]
  let ttlClause = ''
  if (typeof ttlDays === 'number' && ttlDays > 0) {
    ttlClause = `AND "createdAt" > now() - make_interval(days => $3)`
    params.push(ttlDays)
  }
  const existing = await queryWithRLS<{ id: string }>(
    `SELECT id FROM "login_events"
      WHERE "userId" = $1 AND "deviceFingerprint" = $2 ${ttlClause}
      LIMIT 1`,
    params,
    null,
  )
  const isNew = existing.length === 0

  // Always record the login (append-only history), flagged new or not.
  await mutateWithRLS(
    `INSERT INTO "login_events"
       ("userId", "ipAddress", "userAgent", "deviceFingerprint", "isNew")
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, ip === 'unknown' ? null : ip, userAgent, fingerprint, isNew],
    null,
  )

  if (!isNew) return // known device → logged, no email

  await queueNotification(user.id, {
    type: 'newDeviceLogin',
    locale: user.language || I18N_CONFIG.defaultLocale,
    appName: resolveAppName(),
    to: user.email || '',
    userName: user.firstName || user.name,
    ipAddress: ip === 'unknown' ? undefined : ip,
    userAgent: userAgent || undefined,
    occurredAt: new Date().toISOString(),
  })
}

/** Password changed: confirm to the account owner. */
async function handlePasswordChanged(body: AuthResponseBody): Promise<void> {
  const user = body.user
  if (!user?.id || !user.email) return

  await queueNotification(user.id, {
    type: 'passwordChanged',
    locale: user.language || I18N_CONFIG.defaultLocale,
    appName: resolveAppName(),
    to: user.email,
    userName: user.firstName || user.name,
    occurredAt: new Date().toISOString(),
  })
}

/**
 * Email changed: notify the OLD address. The response body has no user, and the
 * old address is exactly what we must reach, so here (and only here) we read the
 * still-valid incoming session to recover it. `auth` is imported lazily to keep
 * the dispatcher's module graph light and avoid any load-order coupling.
 */
async function handleEmailChanged(req: NextRequest): Promise<void> {
  const { auth } = await import('../../auth')
  const session = await auth.api.getSession({ headers: req.headers })
  const user = session?.user as
    | { id?: string; email?: string; name?: string; firstName?: string; language?: string }
    | undefined
  if (!user?.id || !user.email) return

  // The new address is only in the request body (never mutated in the DB until
  // the user confirms via Better Auth's verification link). Optional context.
  let newEmail: string | undefined
  try {
    const reqBody = (await req.json()) as { newEmail?: string } | null
    newEmail = reqBody?.newEmail
  } catch {
    // no/invalid body — the notification still sends without the new-email line
  }

  await queueNotification(user.id, {
    type: 'emailChanged',
    locale: user.language || I18N_CONFIG.defaultLocale,
    appName: resolveAppName(),
    to: user.email, // OLD address — deliberate
    userName: user.firstName || user.name,
    newEmail,
    occurredAt: new Date().toISOString(),
  })
}

/**
 * Map a request path to the security event it represents, or null. Only the
 * paths we act on are listed; everything else is ignored.
 */
function classifyEvent(pathname: string): SecurityEventType | null {
  if (pathname.endsWith('/sign-in/email') || pathname.endsWith('/sign-in/email-otp')) {
    return 'newDeviceLogin'
  }
  if (pathname.endsWith('/change-password')) return 'passwordChanged'
  if (pathname.endsWith('/change-email')) return 'emailChanged'
  return null
}

/**
 * Entry point. Inspect (req, response) and fire the matching security email.
 *
 * @param req      the auth request (a clone is fine; headers + body are read here)
 * @param response the outgoing auth response (cloned before reading its body)
 */
export async function dispatchSecurityNotificationsForRequest(
  req: NextRequest,
  response: NextResponse | Response,
): Promise<void> {
  try {
    const cfg = AUTH_CONFIG.securityNotifications
    if (!cfg?.enabled) return // global kill switch → no-op
    if (!isOk(response)) return // only notify on success

    const event = classifyEvent(getPathname(req))
    if (!event) return

    // Per-event enable flags.
    if (event === 'newDeviceLogin' && !cfg.events?.newDeviceLogin) return
    if (event === 'passwordChanged' && !cfg.events?.passwordChanged) return
    if (event === 'emailChanged' && !cfg.events?.emailChanged) return

    if (event === 'emailChanged') {
      // Reads the incoming session (valid here) — no response body needed.
      await handleEmailChanged(req)
      return
    }

    // newDeviceLogin + passwordChanged read the just-authenticated user from the
    // RESPONSE body (see the file header for why NOT the session).
    let body: AuthResponseBody
    try {
      body = (await response.clone().json()) as AuthResponseBody
    } catch {
      return // e.g. a redirect response (OAuth) has no JSON body — nothing to do
    }

    if (event === 'newDeviceLogin') {
      await handleNewDeviceLogin(req, body)
    } else {
      await handlePasswordChanged(body)
    }
  } catch (error) {
    // NEVER let a notification failure affect the auth response.
    console.error('[security-notifications] dispatch failed:', error)
  }
}
