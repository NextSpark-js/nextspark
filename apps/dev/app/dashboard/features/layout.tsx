import { type ReactNode } from 'react'
import { getTemplateOrDefault } from '@nextsparkjs/registries/template-scopes/server/dashboard/features/layout'

interface FeaturesLayoutProps {
  children: ReactNode
}

function FeaturesLayout({ children }: FeaturesLayoutProps) {
  return (
    <div className="container py-8" data-cy="features-layout">
      {children}
    </div>
  )
}

export default getTemplateOrDefault('app/dashboard/features/layout.tsx', FeaturesLayout)
