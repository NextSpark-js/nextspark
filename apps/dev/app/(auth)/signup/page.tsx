import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SignupForm } from '@nextsparkjs/core/components/auth/forms/SignupForm'
import { getTemplateOrDefault, getMetadataOrDefault } from '@nextsparkjs/core/lib/template-resolver'
import { AUTH_CONFIG } from '@nextsparkjs/core/lib/config'

const defaultMetadata: Metadata = {
  title: 'Create Account',
  description: 'Create your account to start using our platform',
}

export const metadata: Metadata = getMetadataOrDefault(
  'app/(auth)/signup/page.tsx',
  defaultMetadata
)

function SignupPage() {
  const registrationMode = AUTH_CONFIG?.registration?.mode ?? 'open'

  // In domain-restricted or invitation-only modes, redirect to login.
  // Invitation links use /accept-invite/[token] route, not /signup.
  if (registrationMode === 'domain-restricted' || registrationMode === 'invitation-only') {
    redirect('/login')
  }

  return <SignupForm />
}

export const dynamic = 'force-dynamic'

export default getTemplateOrDefault('app/(auth)/signup/page.tsx', SignupPage)