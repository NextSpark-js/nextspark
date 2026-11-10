'use client'

/**
 * Entity configs in the active locale (#421), through the one resolver in `lib/entities/entity-text`.
 */

import { useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { localizeEntityConfig, type EntityTextTranslator, type LocalizableEntity } from '../lib/entities/entity-text'

/** A function that puts an entity config in the active locale (for configs a component gets in a list or a loop). */
export function useEntityLocalizer(): <T extends LocalizableEntity>(config: T) => T {
  const t = useTranslations() as unknown as EntityTextTranslator
  return useCallback(<T extends LocalizableEntity>(config: T) => localizeEntityConfig(config, t), [t])
}

/** The entity config in the active locale; `null` stays `null`. */
export function useLocalizedEntityConfig<T extends LocalizableEntity>(config: T | null): T | null {
  const localize = useEntityLocalizer()
  return useMemo(() => (config ? localize(config) : null), [config, localize])
}

/** Every config of a list in the active locale. */
export function useLocalizedEntityConfigs<T extends LocalizableEntity>(configs: T[]): T[] {
  const localize = useEntityLocalizer()
  return useMemo(() => {
    const localized = configs.map(localize)
    return localized.some((config, index) => config !== configs[index]) ? localized : configs
  }, [configs, localize])
}
