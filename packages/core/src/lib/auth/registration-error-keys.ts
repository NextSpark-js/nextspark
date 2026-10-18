/**
 * Messages for the registration-policy codes the auth API answers with
 * (lib/auth/registration-errors.ts), and for EMAIL_SEND_FAILED (a sign-in code
 * that could not be emailed, lib/auth/code-send.ts), as keys in the `auth` namespace.
 * Kept apart from registration-errors.ts so client code doesn't pull in better-auth.
 */
const KEYS: Record<string, string> = {
  DOMAIN_NOT_ALLOWED: 'registrationErrors.domainNotAllowed',
  SIGNUP_RESTRICTED: 'registrationErrors.signupRestricted',
  SOCIAL_EMAIL_UNVERIFIED: 'registrationErrors.socialEmailUnverified',
  EMAIL_SEND_FAILED: 'emailErrors.sendFailed',
}

export function registrationErrorKey(code: unknown): string | null {
  return typeof code === 'string' ? KEYS[code.toUpperCase()] ?? null : null
}
