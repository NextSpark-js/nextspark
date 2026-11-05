import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AuthErrorPage } from '@nextsparkjs/core/components/auth/pages/AuthErrorPage'
import { authPageMetadata } from '@nextsparkjs/core/routes/_internal/auth-metadata'

export function generateMetadata(): Promise<Metadata> {
  return authPageMetadata('error.generic.title', 'error.generic.description')
}

function AuthErrorPageWrapper() {
  return (
    <Suspense>
      <AuthErrorPage />
    </Suspense>
  )
}


export default AuthErrorPageWrapper
