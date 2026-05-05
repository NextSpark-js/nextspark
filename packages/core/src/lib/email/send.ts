/**
 * Typed convenience helpers around `EMAIL_REGISTRY`.
 *
 * These wrap the four core slugs so call sites can stay readable and keep
 * full type safety on the data argument. For consumer-defined slugs (e.g. a
 * theme's own `purchase-confirmation.ts`), call `EMAIL_REGISTRY['<slug>']`
 * directly — TypeScript infers the data type from each registered function's
 * signature thanks to the `as const` emission in the generated registry.
 */

import { EMAIL_REGISTRY } from '@nextsparkjs/registries/email-registry';
import type {
  EmailContent,
  VerificationEmailData,
  PasswordResetEmailData,
  OtpVerificationEmailData,
  TeamInvitationEmailData,
} from './types';

export const sendVerifyEmail = (
  data: VerificationEmailData,
  locale?: string,
): EmailContent | Promise<EmailContent> =>
  EMAIL_REGISTRY['verify-email'](data, locale);

export const sendResetPasswordEmail = (
  data: PasswordResetEmailData,
  locale?: string,
): EmailContent | Promise<EmailContent> =>
  EMAIL_REGISTRY['reset-password'](data, locale);

export const sendOtpVerificationEmail = (
  data: OtpVerificationEmailData,
  locale?: string,
): EmailContent | Promise<EmailContent> =>
  EMAIL_REGISTRY['otp-verification'](data, locale);

export const sendTeamInvitationEmail = (
  data: TeamInvitationEmailData,
  locale?: string,
): EmailContent | Promise<EmailContent> =>
  EMAIL_REGISTRY['team-invitation'](data, locale);
