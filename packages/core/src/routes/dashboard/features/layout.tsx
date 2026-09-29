import { type ReactNode } from 'react'

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

export default FeaturesLayout
