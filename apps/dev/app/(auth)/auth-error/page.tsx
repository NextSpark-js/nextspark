import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AuthErrorPage } from '@nextsparkjs/core/components/auth/pages/AuthErrorPage'
import { getTemplateOrDefault, getMetadataOrDefault } from '@nextsparkjs/core/lib/template-resolver'

const defaultMetadata: Metadata = {
  title: 'Authentication Error',
  description: 'There was a problem with authentication',
}

export const metadata: Metadata = getMetadataOrDefault(
  'app/(auth)/auth-error/page.tsx',
  defaultMetadata
)

function AuthErrorPageWrapper() {
  return (
    <Suspense>
      <AuthErrorPage />
    </Suspense>
  )
}

export const dynamic = 'force-dynamic'

export default getTemplateOrDefault('app/(auth)/auth-error/page.tsx', AuthErrorPageWrapper)
