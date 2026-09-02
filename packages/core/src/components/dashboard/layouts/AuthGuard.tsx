'use client'

import { useAuth } from '../../../hooks/useAuth'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()

  useAuthMethodDetector()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

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