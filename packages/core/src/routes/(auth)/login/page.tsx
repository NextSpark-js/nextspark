import type { Metadata } from 'next'
import { LoginForm } from '@nextsparkjs/core/components/auth/forms/LoginForm'
import { DEV_CONFIG } from '@nextsparkjs/core/lib/config/config-sync'
import { PUBLIC_AUTH_CONFIG } from '@nextsparkjs/core/lib/config/public-config-client'
import { isDemoMode } from '@nextsparkjs/core/lib/demo/mode'
import { authPageMetadata } from '@nextsparkjs/core/routes/_internal/auth-metadata'
import { loginReserve } from '@nextsparkjs/core/routes/_internal/login-reserve'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Promise<Metadata> {
  return authPageMetadata('login.title', 'login.description')
}

function LoginPage() {
  // A static route: read when the project is built, as the demo mode is (#557)
  const reserve = loginReserve({
    demo: isDemoMode(process.env),
    accounts: DEV_CONFIG?.devKeyring?.users?.length ?? 0,
    methods: PUBLIC_AUTH_CONFIG.methods,
    registration: PUBLIC_AUTH_CONFIG.registration.mode,
  })
  const form = <LoginForm />
  return reserve ? <div className={reserve.className} style={reserve.style}>{form}</div> : form
}


export default LoginPage
