/**
 * Test mock for `@nextsparkjs/registries/email-registry`.
 *
 * Mirrors what the build-time generator (`generators/email-registry.mjs`)
 * emits in production, but constructed by hand so unit tests don't depend
 * on running the real registry build before each test run. Imports the
 * actual core default templates so end-to-end tests for
 * `lib/email/send` and the deprecated `lib/email/templates` adapters
 * exercise real output.
 *
 * Tests that need to spy on the registry should use `jest.mock(
 * '@nextsparkjs/registries/email-registry', ...)` to fully replace this
 * module — that takes precedence over the file mapping.
 */

import verifyEmail from '../../../../../src/emails/verify-email'
import resetPassword from '../../../../../src/emails/reset-password'
import otpVerification from '../../../../../src/emails/otp-verification'
import teamInvitation from '../../../../../src/emails/team-invitation'

export const EMAIL_REGISTRY = {
  'verify-email': verifyEmail,
  'reset-password': resetPassword,
  'otp-verification': otpVerification,
  'team-invitation': teamInvitation,
} as const

export type EmailSlug = keyof typeof EMAIL_REGISTRY

export const EMAIL_REGISTRY_METADATA = {
  'verify-email': { source: 'core' as const, overridden: false },
  'reset-password': { source: 'core' as const, overridden: false },
  'otp-verification': { source: 'core' as const, overridden: false },
  'team-invitation': { source: 'core' as const, overridden: false },
} as const

export const EMAIL_REGISTRY_INFO = {
  totalTemplates: 4,
  generatedAt: 'test-mock',
  slugs: ['verify-email', 'reset-password', 'otp-verification', 'team-invitation'] as const,
} as const
