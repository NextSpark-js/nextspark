import type { Metadata } from 'next'
import { SignupForm } from '@nextsparkjs/core/components/auth/forms/SignupForm'
import { getTemplateOrDefault, getMetadataOrDefault } from '@nextsparkjs/core/lib/template-resolver'

const defaultMetadata: Metadata = {
  title: 'Create Account',
  description: 'Create your account to start using our platform',
}

export const metadata: Metadata = getMetadataOrDefault(
  'app/(auth)/signup/page.tsx',
  defaultMetadata
)

function SignupPage() {
  return <SignupForm />
}

export const dynamic = 'force-dynamic'

export default getTemplateOrDefault('app/(auth)/signup/page.tsx', SignupPage)