import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SignupForm } from '@nextsparkjs/core/components/auth/forms/SignupForm'
import { AUTH_CONFIG } from '@nextsparkjs/core/lib/config'
import { resolveAuthMethods } from '@nextsparkjs/core/lib/auth/auth-methods'
import { TeamService } from '@nextsparkjs/core/lib/services'

// This page reads DB state (TeamService.hasGlobal) and redirect()s during render,
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
async function SignupPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const registrationMode = AUTH_CONFIG?.registration?.mode ?? 'open'
  // An invitation link registers through signup-with-invite, with or without a password
  const invited = typeof (await searchParams)?.inviteToken === 'string'

  // Passwordless preset (no 'email-password' in auth.methods): the account is
  // created by the first one-time-code sign-in, so there is no password signup
  // form to show — send people to /login instead.
  if (!invited && !resolveAuthMethods(AUTH_CONFIG).includes('email-password')) {
    redirect('/login')
  }

  // In invitation-only mode, allow the first user to register
  // (when no global team exists yet). Subsequent users need invitations.
  if (registrationMode === 'invitation-only') {
    const hasGlobalTeam = await TeamService.hasGlobal()
    if (hasGlobalTeam) {
      // A team exists, so this is not the first user - redirect to login
      // Invitation links use /accept-invite/[token] route, not /signup
      redirect('/login')
    }
    // No team exists yet - allow first user to register
  }

  // In domain-restricted mode, always redirect to login
  if (registrationMode === 'domain-restricted') {
    redirect('/login')
  }

  return <SignupForm />
}

export default SignupPage
