/**
 * Content Translation Hook for Entity System
 * 
 * Provides entity-aware translations with namespace management
 */

'use client'

import { useTranslations } from 'next-intl'
import { useMemo } from 'react'

/**
 * Entity translation hook that combines multiple namespaces
 */
export function useEntityTranslation(entityName: string, additionalNamespaces: string[] = []) {
  // Primary namespaces based on entity context
  const commonT = useTranslations('common')
  const entityT = useTranslations(entityName) // Entity-specific translations
  
  // Always load all possible additional namespaces to avoid conditional hooks
  const validationT = useTranslations('validation')
  const settingsT = useTranslations('settings') 
  const dashboardT = useTranslations('dashboard')
  const authT = useTranslations('auth')
  const publicT = useTranslations('public')
  const adminT = useTranslations('admin')
  
  // Build available translations based on requested namespaces
  const additionalTranslations = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const translations: Record<string, any> = {}
    
    if (additionalNamespaces.includes('validation')) {
      translations.validation = validationT
    }
    if (additionalNamespaces.includes('settings')) {
      translations.settings = settingsT
    }
    if (additionalNamespaces.includes('dashboard')) {
      translations.dashboard = dashboardT
    }
    if (additionalNamespaces.includes('auth')) {
      translations.auth = authT
    }
    if (additionalNamespaces.includes('public')) {
      translations.public = publicT
    }
    if (additionalNamespaces.includes('admin')) {
      translations.admin = adminT
    }
    
    return translations
  }, [additionalNamespaces, validationT, settingsT, dashboardT, authT, publicT, adminT])

  return useMemo(() => ({
    // Entity-specific translations with fallback to common
    t: (key: string, values?: Record<string, string | number | Date>) => {
      try {
        return entityT(key, values)
      } catch {
        try {
          return commonT(key, values)
        } catch {
          console.warn(`[useEntityTranslation] Missing translation key: ${key} for entity: ${entityName}`)
          return key
        }
      }
    },
    
    // Common translations
    common: commonT,
    
    // Entity-specific translations
    entity: entityT,
    
    // Additional namespaces
    ns: additionalTranslations,
    
    // Utility functions
    exists: (key: string): boolean => {
      try {
        entityT(key)
        return true
      } catch {
        try {
          commonT(key)
          return true
        } catch {
          return false
        }
      }
    },
    
    // Get translation from specific namespace
    fromNamespace: (namespace: string, key: string, values?: Record<string, string | number | Date>) => {
      if (additionalTranslations[namespace]) {
        return additionalTranslations[namespace](key, values)
      }
      
      if (namespace === 'common') {
        return commonT(key, values)
      }
      
      if (namespace === entityName) {
        return entityT(key, values)
      }
      
      console.warn(`[useEntityTranslation] Namespace not loaded: ${namespace}`)
      return key
    }
  }), [commonT, entityT, additionalTranslations, entityName])
}

/**
 * Simplified entity-specific translation hook
 */
export function useSimpleEntityTranslation(entityName: string) {
  const commonT = useTranslations('common')
  const entityT = useTranslations(entityName)
  
  return useMemo(() => ({
    t: (key: string, values?: Record<string, string | number | Date>) => {
      try {
        return entityT(key, values)
      } catch {
        try {
          return commonT(key, values)
        } catch {
          console.warn(`[useSimpleEntityTranslation] Missing translation key: ${key} for entity: ${entityName}`)
          return key
        }
      }
    },
    common: commonT,
    entity: entityT
  }), [commonT, entityT, entityName])
}

/**
 * Form-specific translation hook with validation messages
 */
export function useFormTranslation(entityName: string, formName?: string) {
  const { t, common, entity, ns } = useEntityTranslation(entityName, ['validation'])
  
  return useMemo(() => ({
    // Form field labels
    label: (field: string) => {
      const labelKey = formName ? `forms.${formName}.${field}.label` : `fields.${field}.label`
      return t(labelKey)
    },
    
    // Form field placeholders
    placeholder: (field: string) => {
      const placeholderKey = formName ? `forms.${formName}.${field}.placeholder` : `fields.${field}.placeholder`
      return t(placeholderKey)
    },
    
    // Form field help text
    help: (field: string) => {
      const helpKey = formName ? `forms.${formName}.${field}.help` : `fields.${field}.help`
      return t(helpKey)
    },
    
    // Validation messages
    validation: (field: string, rule: string) => {
      const validationKey = `${field}.${rule}`
      try {
        return ns.validation(validationKey)
      } catch {
        return common(`validation.${rule}`)
      }
    },
    
    // Form actions
    action: (action: string) => {
      const actionKey = formName ? `forms.${formName}.actions.${action}` : `actions.${action}`
      return t(actionKey)
    },
    
    // Form messages
    message: (message: string) => {
      const messageKey = formName ? `forms.${formName}.messages.${message}` : `messages.${message}`
      return t(messageKey)
    },
    
    // Direct access to translation functions
    t,
    common,
    entity,
    validationNs: ns.validation
  }), [t, common, entity, ns, formName])
}

/**
 * Table/List translation hook for entity data display
 */
export function useTableTranslation(entityName: string) {
  const { t, common } = useEntityTranslation(entityName)
  
  return useMemo(() => ({
    // Column headers
    column: (columnName: string) => {
      return t(`table.columns.${columnName}`)
    },
    
    // Table actions
    action: (actionName: string) => {
      return t(`table.actions.${actionName}`)
    },
    
    // Status translations
    status: (statusValue: string) => {
      return t(`statuses.${statusValue}`)
    },
    
    // Empty states
    empty: (context = 'default') => {
      return t(`table.empty.${context}`)
    },
    
    // Loading states
    loading: (context = 'default') => {
      return common(`loading.${context}`)
    },
    
    // Pagination
    pagination: (key: string) => {
      return common(`pagination.${key}`)
    },
    
    // Search/Filter
    search: (key: string) => {
      return common(`search.${key}`)
    },
    
    // Bulk actions
    bulk: (action: string) => {
      return t(`table.bulk.${action}`)
    },
    
    // Direct access
    t,
    common
  }), [t, common])
}