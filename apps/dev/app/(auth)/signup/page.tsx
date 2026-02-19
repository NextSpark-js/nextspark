import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SignupForm } from '@nextsparkjs/core/components/auth/forms/SignupForm'
import { getTemplateOrDefault, getMetadataOrDefault } from '@nextsparkjs/core/lib/template-resolver'
import { AUTH_CONFIG } from '@nextsparkjs/core/lib/config'
import { TeamService } from '@nextsparkjs/core/lib/services'

const defaultMetadata: Metadata = {
  title: 'Create Account',
  description: 'Create your account to start using our platform',
}

export const metadata: Metadata = getMetadataOrDefault(
  'app/(auth)/signup/page.tsx',
  defaultMetadata
)

async function SignupPage() {
  const registrationMode = AUTH_CONFIG?.registration?.mode ?? 'open'

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

export const dynamic = 'force-dynamic'

export default getTemplateOrDefault('app/(auth)/signup/page.tsx', SignupPage)