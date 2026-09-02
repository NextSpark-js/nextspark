/**
 * Security Notifications — shared types.
 *
 * Built-in security email notifications for three scenarios Better Auth does
 * not cover out of the box (issue #75):
 *   - new-device login alerts
 *   - password-changed confirmation
 *   - email-changed notification (sent to the OLD address)
 */

/**
 * The three security events. Keys match `AUTH_CONFIG.securityNotifications.events`
 * so a single key toggles both the config flag and the template lookup.
 */
export type SecurityEventType =
  | 'newDeviceLogin'
  | 'passwordChanged'
  | 'emailChanged'

/**
 * Context passed to a template builder. `appName` is always present; the rest is
 * event-specific and best-effort (any field may be undefined if it could not be
 * resolved from the request/response without leaking user-existence info).
 */
export interface SecurityEmailContext {
  /** Event this email is for. */
  type: SecurityEventType
  /** Resolved locale (BCP47) used to pick copy; falls back to the app default. */
  locale: string
  /** Display name of the application (NEXT_PUBLIC_APP_NAME or config). */
  appName: string
  /** The user's display name / first name, when known. */
  userName?: string
  /** Recipient email address (the OLD address for `emailChanged`). */
  email?: string
  /** New device sign-in metadata (newDeviceLogin only). */
  ipAddress?: string
  userAgent?: string
  /** When the event happened (ISO string), for display in the email body. */
  occurredAt?: string
  /** For emailChanged: the address the account is being moved TO. */
  newEmail?: string
}

/** What a template builder returns. `text` is an optional plain-text fallback. */
export interface SecurityEmailContent {
  subject: string
  html: string
  text?: string
}

/**
 * A template builder turns a context into rendered email content. Themes register
 * their own builders (per type + locale) via `registerSecurityEmailTemplate` to
 * brand/translate these emails without forking core.
 */
export type SecurityEmailTemplateBuilder = (
  ctx: SecurityEmailContext,
) => SecurityEmailContent | Promise<SecurityEmailContent>

/**
 * Payload persisted on the `auth:security-notification` scheduled action. Kept to
 * plain references + already-resolved display data (never secrets): the handler
 * only needs it to render and send the email.
 */
export interface SecurityNotificationActionPayload {
  type: SecurityEventType
  locale: string
  appName: string
  /** Recipient (OLD address for emailChanged). */
  to: string
  userName?: string
  ipAddress?: string
  userAgent?: string
  occurredAt?: string
  newEmail?: string
  /**
   * Dedup discriminator so scheduleAction() collapses rapid duplicates of the
   * same (user, event). Present for the scheduler's entityId-based dedup only.
   */
  entityId?: string
  entityType?: string
}
