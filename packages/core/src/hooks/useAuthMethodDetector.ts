'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLastAuthMethod } from './useLastAuthMethod'

/**
 * Hook to detect and save authentication method from URL parameters
 * Used primarily for OAuth redirects where the auth method needs to be saved after successful login
 */
export function useAuthMethodDetector() {
  const searchParams = useSearchParams()
  const { saveAuthMethod } = useLastAuthMethod()

  useEffect(() => {
    const authMethod = searchParams.get('auth_method')

    if (authMethod === 'google') {
      // Save the auth method when coming from OAuth redirect
      saveAuthMethod('google')

      // Clean the URL parameter without causing a reload
      if (typeof window !== 'undefined') {
        try {
          const url = new URL(window.location.href)
          url.searchParams.delete('auth_method')
          window.history.replaceState({}, '', url.toString())
        } catch (error) {
          // URL cleanup failed, but auth method was still saved successfully
          // Silently ignore URL cleanup errors
        }
      }
    }
  }, [searchParams, saveAuthMethod])
}