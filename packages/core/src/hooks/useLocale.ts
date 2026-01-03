'use client'

import { useState, useCallback } from 'react'

import { useUserProfile } from './useUserProfile'
import { setUserLocaleClient } from '../lib/locale-client'
import { I18N_CONFIG, type SupportedLocale } from '../lib/config'

export function useLocale() {
  const { profile, updateProfile } = useUserProfile()

  const [isChanging, setIsChanging] = useState(false)

  const currentLocale = (profile?.language as SupportedLocale) || I18N_CONFIG.defaultLocale

  const changeLanguage = useCallback(async (newLocale: SupportedLocale) => {
    if (newLocale === currentLocale) return

    setIsChanging(true)
    try {
      // 1. Actualizar en base de datos
      await updateProfile({ language: newLocale })
      
      // 2. Actualizar cookie para next-intl
      setUserLocaleClient(newLocale)
      
      // 3. Force full page reload to apply language change
      window.location.reload()
    } catch (error) {
      console.error('Error changing language:', error)
      
      // Toast notification for user feedback
      if (typeof window !== 'undefined') {
        // Only import toast on client side
        const { toast } = await import('sonner')
        toast.error('Failed to change language. Please try again.')
      }
      
      // Reset loading state on error
      throw error
    } finally {
      setIsChanging(false)
    }
  }, [currentLocale, updateProfile])

  return {
    locale: currentLocale,
    changeLanguage,
    isChanging,
    supportedLocales: I18N_CONFIG.supportedLocales
  }
}
