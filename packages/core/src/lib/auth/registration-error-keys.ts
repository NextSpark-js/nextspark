/**
 * Messages for the registration-policy codes the auth API answers with
 * (lib/auth/registration-errors.ts), as keys in the `auth` namespace.
 * Kept apart from registration-errors.ts so client code doesn't pull in better-auth.
 */
const KEYS: Record<string, string> = {
  DOMAIN_NOT_ALLOWED: 'registrationErrors.domainNotAllowed',
  SIGNUP_RESTRICTED: 'registrationErrors.signupRestricted',
}

export function registrationErrorKey(code: unknown): string | null {
  return typeof code === 'string' ? KEYS[code.toUpperCase()] ?? null : null
}
