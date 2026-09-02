/**
 * Built-in security email notifications (issue #75).
 *
 * Public surface:
 *   - dispatchSecurityNotificationsForRequest(req, response)  → wire into the
 *       Better Auth route handler (best-effort, guarded by config).
 *   - registerSecurityEmailTemplate(type, locale, builder)    → theme branding
 *       / localization override, no core fork required.
 *   - computeDeviceFingerprint(ua, ip) / extractClientIp(headers) → fingerprint
 *       primitives (also used by tests).
 *
 * The scheduled-action handler that actually sends the email lives at
 * `@nextsparkjs/core/lib/scheduled-actions/handlers` as
 * `registerSecurityNotificationAction()`.
 */

export { dispatchSecurityNotificationsForRequest } from './dispatcher'
export {
  registerSecurityEmailTemplate,
  getSecurityEmailTemplate,
  clearSecurityEmailTemplates,
} from './registry'
export {
  computeDeviceFingerprint,
  extractClientIp,
  normalizeUserAgent,
  ipToNetworkKey,
} from './device-fingerprint'

export type {
  SecurityEventType,
  SecurityEmailContext,
  SecurityEmailContent,
  SecurityEmailTemplateBuilder,
  SecurityNotificationActionPayload,
} from './types'
