/**
 * Deprecated email-templates surface.
 *
 * Prior to the email-registry refactor (0.1.0-beta.150) this file shipped four
 * monolithic English-only templates accessed via `emailTemplates.<slug>(data)`.
 * That made it impossible for themes to brand or translate transactional
 * emails without forking core.
 *
 * The replacement is the build-time `EMAIL_REGISTRY` in
 * `@nextsparkjs/registries/email-registry`, with theme overrides at
 * `themes/<active-theme>/emails/<slug>.ts`. Typed convenience helpers live in
 * `@nextsparkjs/core/lib/email/send` (`sendVerifyEmail`, `sendResetPasswordEmail`,
 * `sendOtpVerificationEmail`, `sendTeamInvitationEmail`).
 *
 * The exports below are kept as thin async adapters so out-of-tree consumers
 * keep working for one release cycle. They will be removed in a future release.
 */

import { EMAIL_REGISTRY } from '@nextsparkjs/registries/email-registry';
import type {
  VerificationEmailData,
  PasswordResetEmailData,
  TeamInvitationEmailData,
  OtpVerificationEmailData,
  EmailContent,
} from './types';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Your App';

/**
 * @deprecated Use the typed helpers from `@nextsparkjs/core/lib/email/send`
 * (e.g. `sendVerifyEmail`) or `EMAIL_REGISTRY['<slug>']` directly. This object
 * is kept for one release cycle to avoid breaking out-of-tree consumers.
 */
export const emailTemplates = {
  verifyEmail: (data: VerificationEmailData): Promise<EmailContent> =>
    Promise.resolve(EMAIL_REGISTRY['verify-email'](data)),
  resetPassword: (data: PasswordResetEmailData): Promise<EmailContent> =>
    Promise.resolve(EMAIL_REGISTRY['reset-password'](data)),
  otpVerification: (data: OtpVerificationEmailData): Promise<EmailContent> =>
    Promise.resolve(EMAIL_REGISTRY['otp-verification'](data)),
  teamInvitation: (data: TeamInvitationEmailData): Promise<EmailContent> =>
    Promise.resolve(EMAIL_REGISTRY['team-invitation'](data)),
};

/**
 * @deprecated Use `sendVerifyEmail({ userName, verificationUrl, appName })`
 * from `@nextsparkjs/core/lib/email/send`.
 */
export const createVerificationEmail = (name: string | undefined, verifyUrl: string) =>
  EMAIL_REGISTRY['verify-email']({
    userName: name || '',
    verificationUrl: verifyUrl,
    appName: APP_NAME,
  });

/**
 * @deprecated Use `sendResetPasswordEmail({ userName, resetUrl, appName })`
 * from `@nextsparkjs/core/lib/email/send`.
 */
export const createPasswordResetEmail = (name: string | undefined, resetUrl: string) =>
  EMAIL_REGISTRY['reset-password']({
    userName: name || '',
    resetUrl: resetUrl,
    appName: APP_NAME,
  });

/**
 * @deprecated Use `sendTeamInvitationEmail({ inviteeEmail, inviterName, teamName, role, acceptUrl, expiresIn, appName })`
 * from `@nextsparkjs/core/lib/email/send`.
 */
export const createTeamInvitationEmail = (
  inviteeEmail: string,
  inviterName: string,
  teamName: string,
  role: string,
  acceptUrl: string,
  expiresIn: string = '7 days',
) =>
  EMAIL_REGISTRY['team-invitation']({
    inviteeEmail,
    inviterName,
    teamName,
    role,
    acceptUrl,
    expiresIn,
    appName: APP_NAME,
  });
