import type { Metadata } from 'next'
import { LoginForm } from '@nextsparkjs/core/components/auth/forms/LoginForm'
import { getTemplateOrDefault, getMetadataOrDefault } from '@nextsparkjs/registries/template-scopes/server/(auth)/login/page'

export const dynamic = 'force-dynamic'

const defaultMetadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your account to access the platform',
}

export const metadata: Metadata = getMetadataOrDefault(
  'app/(auth)/login/page.tsx',
  defaultMetadata
)

function LoginPage() {
  return <LoginForm />
}


export default getTemplateOrDefault('app/(auth)/login/page.tsx', LoginPage)