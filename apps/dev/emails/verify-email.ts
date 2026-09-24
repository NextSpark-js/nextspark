/**
 * Default theme override: Verify Email.
 *
 * This file overrides core's default `verify-email` template when the active
 * theme is `default`. It exists primarily as a working demo of the override
 * convention — drop a sibling file (e.g. `reset-password.ts`,
 * `otp-verification.ts`, `team-invitation.ts`, or any new slug like
 * `welcome.ts`) and rebuild the registry to override or add templates.
 *
 * The visible-but-small customization here is the subject prefix
 * "[default theme] " — enough to distinguish this output from core's default
 * during end-to-end verification, while keeping the body identical.
 *
 * To remove the override and fall back to core's default: delete this file
 * and rebuild the registry.
 */

import coreVerifyEmail from '@nextsparkjs/core/emails/verify-email'
import type {
  EmailContent,
  VerificationEmailData,
} from '@nextsparkjs/core/lib/email/types'

export default async function verifyEmail(
  data: VerificationEmailData,
  locale?: string,
): Promise<EmailContent> {
  const result = await coreVerifyEmail(data, locale)
  return {
    ...result,
    subject: `[default theme] ${result.subject}`,
  }
}
