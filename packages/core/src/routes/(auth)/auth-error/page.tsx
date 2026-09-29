import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AuthErrorPage } from '@nextsparkjs/core/components/auth/pages/AuthErrorPage'

const defaultMetadata: Metadata = {
  title: 'Authentication Error',
  description: 'There was a problem with authentication',
}

export const metadata: Metadata = defaultMetadata

function AuthErrorPageWrapper() {
  return (
    <Suspense>
      <AuthErrorPage />
    </Suspense>
  )
}


export default AuthErrorPageWrapper
