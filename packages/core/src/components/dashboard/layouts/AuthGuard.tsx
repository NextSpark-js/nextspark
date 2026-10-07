'use client'

import { useAuth } from '../../../hooks/useAuth'
import { loadLoginPage } from '../../../lib/auth/load-login-page'
import { useEffect } from 'react'
import { DashboardAuthSkeleton } from './DashboardAuthSkeleton'
import { useEnsureUserMetadata } from '../../../hooks/useEnsureUserMetadata'
import { useAuthMethodDetector } from '../../../hooks/useAuthMethodDetector'

interface AuthGuardProps {
  children: React.ReactNode
}

function EnsureUserMetadata() {
  useEnsureUserMetadata()
  return null
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, isLoading } = useAuth()

  useAuthMethodDetector()

  useEffect(() => {
    if (!isLoading && !user) {
      loadLoginPage()
    }
  }, [user, isLoading])

  if (isLoading) {
    return <DashboardAuthSkeleton />
  }

  if (!user) {
    return null
  }

  return (
    <>
      <EnsureUserMetadata />
      {children}
    </>
  )
}