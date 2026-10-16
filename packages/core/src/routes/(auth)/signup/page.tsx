import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SignupForm } from '@nextsparkjs/core/components/auth/forms/SignupForm'
import { AUTH_CONFIG } from '@nextsparkjs/core/lib/config'
import { resolveAuthMethods } from '@nextsparkjs/core/lib/auth/auth-methods'
import { TeamService } from '@nextsparkjs/core/lib/services'
import { safeCallbackPath } from '@nextsparkjs/core/lib/auth/callback-url'

// This page reads DB state (TeamService.isBootstrapDone) and redirect()s during render,
// so it must render per-request and never be statically prerendered at build time.
export const dynamic = 'force-dynamic'

const defaultMetadata: Metadata = {
  title: 'Create Account',
  description: 'Create your account to start using our platform',
}

export const metadata: Metadata = defaultMetadata

// No Suspense boundary around the content: redirect() inside one is thrown after the shell was
// flushed, so it reaches the browser as a 200 with a meta refresh instead of a 307. The page is
// force-dynamic, so useSearchParams in SignupForm does not need a boundary to prerender.
type SignupSearchParams = Record<string, string | string[] | undefined>

// /login keeps the invitation context so the invited person returns to /accept-invite/<token>.
// callbackUrl passes only as a same-site path; inviteToken stays out (it lives in that path).
function loginUrl(params: SignupSearchParams = {}) {
  const query = new URLSearchParams()
  const callbackUrl = safeCallbackPath(typeof params.callbackUrl === 'string' ? params.callbackUrl : null)
  if (callbackUrl) query.set('callbackUrl', callbackUrl)
  for (const key of ['fromInvite', 'email']) {
    if (typeof params[key] === 'string') query.set(key, params[key])
  }
  const qs = query.toString()
  return qs ? `/login?${qs}` : '/login'
}

async function SignupPage({ searchParams }: { searchParams?: Promise<SignupSearchParams> }) {
  const registrationMode = AUTH_CONFIG?.registration?.mode ?? 'open'
  const params = (await searchParams) ?? {}
  // An invitation link registers through signup-with-invite, with or without a password
  const invited = typeof params.inviteToken === 'string'

  // Passwordless preset (no 'email-password' in auth.methods): the account is
  // created by the first one-time-code sign-in, so there is no password signup
  // form to show — send people to /login instead.
  if (!invited && !resolveAuthMethods(AUTH_CONFIG).includes('email-password')) {
    redirect(loginUrl(params))
  }

  // In invitation-only mode, allow the first user to register
  // (until the bootstrap is over). Subsequent users need invitations.
  if (registrationMode === 'invitation-only') {
    if (await TeamService.isBootstrapDone()) {
      // Not the first user - redirect to login
      // Invitation links use /accept-invite/[token] route, not /signup
      redirect(loginUrl(params))
    }
    // No team exists yet - allow first user to register
  }

  // In domain-restricted mode, always redirect to login
  if (registrationMode === 'domain-restricted') {
    redirect(loginUrl(params))
  }

  return <SignupForm />
}

export default SignupPage
