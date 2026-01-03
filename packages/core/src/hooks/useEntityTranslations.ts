/**
 * Entity Translation Hooks
 *
 * React hooks for accessing entity-specific translations
 */

import { useCallback, useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { TranslationService } from '../lib/services/translation.service'
import { loadMergedTranslations } from '../lib/translations/registry'
import { useEnabledEntities } from './useEnabledEntities'
import type { SupportedLocale } from '../lib/entities/types'

/**
 * Hook to get translations for a specific entity
 */
export function useEntityTranslations(entityName: string) {
  const locale = useLocale() as SupportedLocale
  const { entities } = useEnabledEntities()
  const [translations, setTranslations] = useState<Record<string, unknown>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTranslations = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const entity = entities.find(e => e.slug === entityName)
      if (!entity) {
        setError(`Entity ${entityName} not found`)
        return
      }

      // Load entity translations directly from TranslationService
      const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'
      const entityTranslations = await TranslationService.loadEntity(activeTheme, entityName, locale)

      setTranslations(entityTranslations)
    } catch (err) {
      console.error(`Error loading translations for entity ${entityName}:`, err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [entityName, locale, entities])

  useEffect(() => {
    if (entities.length > 0) {
      loadTranslations()
    }
  }, [loadTranslations, entities.length])

  /**
   * Get a translation value with fallback
   */
  const t = useCallback((key: string, fallback?: string): string => {
    const keys = key.split('.')
    let value: unknown = translations
    
    for (const k of keys) {
      if (value && typeof value === 'object' && value !== null && k in value) {
        value = (value as Record<string, unknown>)[k]
      } else {
        return fallback || key
      }
    }
    
    return typeof value === 'string' ? value : fallback || key
  }, [translations])

  /**
   * Check if a translation key exists
   */
  const hasTranslation = useCallback((key: string): boolean => {
    const keys = key.split('.')
    let value: unknown = translations
    
    for (const k of keys) {
      if (value && typeof value === 'object' && value !== null && k in value) {
        value = (value as Record<string, unknown>)[k]
      } else {
        return false
      }
    }
    
    return typeof value === 'string'
  }, [translations])

  return {
    translations,
    t,
    hasTranslation,
    isLoading,
    error,
    reload: loadTranslations
  }
}

/**
 * Hook to get all entity translations for current locale
 */
export function useAllEntityTranslations() {
  const locale = useLocale() as SupportedLocale
  const { entities, isLoading: entitiesLoading } = useEnabledEntities()
  const [allTranslations, setAllTranslations] = useState<Record<string, unknown>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAllTranslationsCallback = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Use loadMergedTranslations which handles core + theme + entity merge
      const translations = await loadMergedTranslations(locale)
      setAllTranslations(translations)
    } catch (err) {
      console.error('Error loading all entity translations:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [locale])

  useEffect(() => {
    if (!entitiesLoading && entities.length > 0) {
      loadAllTranslationsCallback()
    }
  }, [loadAllTranslationsCallback, entitiesLoading, entities.length])

  return {
    translations: allTranslations,
    isLoading: isLoading || entitiesLoading,
    error,
    reload: loadAllTranslationsCallback
  }
}
