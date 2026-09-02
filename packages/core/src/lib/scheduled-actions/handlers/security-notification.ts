/**
 * Scheduled Action Handler: auth:security-notification
 *
 * Renders and sends one built-in security email (new-device login, password
 * changed, or email changed — issue #75). Enqueued by the security-notifications
 * dispatcher; executed asynchronously by the cron processor so a slow email
 * provider never blocks the auth response.
 *
 * The handler:
 *   1. reads the shared email provider (EmailFactory.getInstance())
 *   2. resolves the template builder for (type, locale) — a theme override if
 *      registered, otherwise the core baseline (getSecurityEmailTemplate)
 *   3. builds { subject, html } and sends to `payload.to`
 *
 * On any failure it THROWS, so the scheduled-actions processor records the error
 * and retries per the action's maxRetries (email dispatch is worth retrying).
 */

import { registerScheduledAction } from '../registry'
import type { ScheduledAction } from '../types'
import { EmailFactory } from '../../email'
import { getSecurityEmailTemplate } from '../../auth/security-notifications/registry'
import type {
  SecurityNotificationActionPayload,
  SecurityEmailContext,
} from '../../auth/security-notifications/types'

const ACTION_TYPE = 'auth:security-notification'

/**
 * Register the `auth:security-notification` handler.
 *
 * Idempotent at the registry level (re-registering warns + overwrites). Safe to
 * call from the dispatcher (lazily, on first use) and/or from theme/server
 * bootstrap.
 */
export function registerSecurityNotificationAction(): void {
  registerScheduledAction(
    ACTION_TYPE,
    async (payload: unknown, action: ScheduledAction): Promise<void> => {
      const data = payload as SecurityNotificationActionPayload

      if (!data?.to || !data?.type) {
        // Nothing we can do with a malformed payload; don't retry forever.
        console.warn(
          `[auth:security-notification] Skipping action ${action.id}: missing "to" or "type"`,
        )
        return
      }

      const ctx: SecurityEmailContext = {
        type: data.type,
        locale: data.locale,
        appName: data.appName,
        userName: data.userName,
        email: data.to,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        occurredAt: data.occurredAt,
        newEmail: data.newEmail,
      }

      const builder = getSecurityEmailTemplate(data.type, data.locale)
      const { subject, html, text } = await builder(ctx)

      const emailService = EmailFactory.getInstance()
      const response = await emailService.send({
        to: data.to,
        subject,
        html,
        ...(text ? { text } : {}),
      })

      if (!response.success) {
        // Throw so the processor marks the attempt failed and retries.
        throw new Error(
          `[auth:security-notification] Failed to send '${data.type}' email: ${
            response.error ?? 'unknown error'
          }`,
        )
      }

      console.log(
        `[auth:security-notification] Sent '${data.type}' email (action ${action.id})`,
      )
    },
    {
      description: 'Send a built-in security email (new-device / password / email changed)',
      timeout: 20000,
    },
  )

  console.log('[ScheduledActions] Registered handler: auth:security-notification')
}
