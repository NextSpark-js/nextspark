import type { Metadata } from 'next'
import { LoginForm } from '@nextsparkjs/core/components/auth/forms/LoginForm'
import { authPageMetadata } from '@nextsparkjs/core/routes/_internal/auth-metadata'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Promise<Metadata> {
  return authPageMetadata('login.title', 'login.description')
}

function LoginPage() {
  return <LoginForm />
}


export default LoginPage