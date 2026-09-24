/**
 * Theme override: Verify Email.
 *
 * Drop your branded HTML and copy here to customize the verification email.
 * The build-time email registry in `@nextsparkjs/registries/email-registry`
 * will pick this file over the core default at the same slug.
 *
 * The other three core slugs you can override or add to:
 *   - reset-password.ts
 *   - otp-verification.ts
 *   - team-invitation.ts
 *
 * You can also add brand-new slugs here (e.g. `welcome.ts`,
 * `purchase-confirmation.ts`). They're picked up automatically by the
 * registry generator and become available as `EMAIL_REGISTRY['<slug>']` —
 * with full per-slug TypeScript inference of the data argument.
 *
 * Out of the box this file simply delegates to core so the project keeps
 * working before you brand it. Replace the body with your own HTML when
 * you're ready, or delete this file entirely to fall back to the core default.
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
  return coreVerifyEmail(data, locale)
}
