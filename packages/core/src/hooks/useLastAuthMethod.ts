'use client'

import { useEffect, useState, useCallback } from 'react'
import type { AuthMethod } from '../types/auth'

const LAST_AUTH_METHOD_KEY = 'last-auth-method'

export function useLastAuthMethod() {
  const [lastMethod, setLastMethod] = useState<AuthMethod>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Small delay to prevent flash of badge on initial load
    const timer = setTimeout(() => {
      try {
        const stored = localStorage.getItem(LAST_AUTH_METHOD_KEY)
        if (stored === 'email' || stored === 'google') {
          setLastMethod(stored)
        }
      } catch (error) {
        // Handle localStorage errors gracefully (e.g., in private browsing mode)
        console.warn('Failed to read from localStorage:', error)
        setLastMethod(null)
      }
      setIsReady(true)
    }, 150) // Small delay for better visual experience

    return () => clearTimeout(timer)
  }, [])

  const saveAuthMethod = useCallback((method: 'email' | 'google') => {
    try {
      localStorage.setItem(LAST_AUTH_METHOD_KEY, method)
      setLastMethod(method)
    } catch (error) {
      console.warn('Failed to save to localStorage:', error)
      // Still update state even if localStorage fails
      setLastMethod(method)
    }
  }, [])

  const clearAuthMethod = useCallback(() => {
    try {
      localStorage.removeItem(LAST_AUTH_METHOD_KEY)
    } catch (error) {
      console.warn('Failed to clear localStorage:', error)
    }
    // Always clear state regardless of localStorage
    setLastMethod(null)
  }, [])

  return {
    lastMethod,
    saveAuthMethod,
    clearAuthMethod,
    isReady,
  }
}