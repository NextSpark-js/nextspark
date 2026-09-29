import type { Metadata } from 'next'
import { LoginForm } from '@nextsparkjs/core/components/auth/forms/LoginForm'

export const dynamic = 'force-dynamic'

const defaultMetadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your account to access the platform',
}

export const metadata: Metadata = defaultMetadata

function LoginPage() {
  return <LoginForm />
}


export default LoginPage