import { ReactNode } from 'react'

interface FeaturesLayoutProps {
  children: ReactNode
}

export default function FeaturesLayout({ children }: FeaturesLayoutProps) {
  return (
    <div className="container py-8" data-cy="features-layout">
      {children}
    </div>
  )
}
