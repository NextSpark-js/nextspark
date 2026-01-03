import type { EntityConfig, ChildEntityDefinition, SupportedLocale, TranslationLoader } from './types'
import type { LucideIcon } from 'lucide-react'
import * as Icons from 'lucide-react'

export interface SerializableEntityConfig extends Omit<EntityConfig, 'icon' | 'i18n'> {
  iconName: string
  i18nFallbackLocale: string
}

export interface SerializableChildEntityConfig extends Omit<ChildEntityDefinition, 'icon' | 'i18n'> {
  iconName: string
  i18nFallbackLocale: string
}

export type SerializableConfig = SerializableEntityConfig | SerializableChildEntityConfig

function isEntityConfig(config: EntityConfig | ChildEntityDefinition): config is EntityConfig {
  return 'ui' in config && typeof config.ui === 'object' && config.ui !== null && 'dashboard' in config.ui
}

function isChildEntityConfig(config: EntityConfig | ChildEntityDefinition): config is ChildEntityDefinition {
  return 'parent' in config && typeof config.parent === 'string'
}

export function serializeEntityConfig(config: EntityConfig): SerializableEntityConfig {
  const iconName = Object.entries(Icons).find(
    ([, icon]) => icon === config.icon
  )?.[0] || 'Box'

  const { icon, i18n, ...rest } = config

  return {
    ...rest,
    iconName,
    i18nFallbackLocale: i18n?.fallbackLocale || 'en'
  } as SerializableEntityConfig
}

export function serializeChildEntityConfig(config: ChildEntityDefinition): SerializableChildEntityConfig {
  // ChildEntityDefinition doesn't have icon or i18n properties
  // Return the config as-is since it's already serializable
  return {
    ...config,
    iconName: 'Box', // Default icon for child entities
    i18nFallbackLocale: 'en' // Default locale
  } as SerializableChildEntityConfig
}

export function serializeConfig(config: EntityConfig | ChildEntityDefinition): SerializableConfig {
  if (isChildEntityConfig(config)) {
    return serializeChildEntityConfig(config)
  } else {
    return serializeEntityConfig(config)
  }
}

export function deserializeEntityConfig(config: SerializableEntityConfig): EntityConfig {
  const icon = (Icons[config.iconName as keyof typeof Icons] || Icons.Box) as LucideIcon
  const { iconName, i18nFallbackLocale, ...rest } = config

  return {
    ...rest,
    icon,
    i18n: {
      fallbackLocale: i18nFallbackLocale as SupportedLocale,
      loaders: {} as Record<SupportedLocale, TranslationLoader> // Loaders are not serializable, will be handled separately
    }
  }
}

export function deserializeChildEntityConfig(config: SerializableChildEntityConfig): ChildEntityDefinition {
  const { iconName, i18nFallbackLocale, ...rest } = config

  // ChildEntityDefinition doesn't have icon or i18n properties
  // Return only the properties that exist on ChildEntityDefinition
  return {
    ...rest
  } as ChildEntityDefinition
}

export function serializeEntities(entities: (EntityConfig | ChildEntityDefinition)[]): SerializableConfig[] {
  return entities.map(serializeConfig)
}

export function deserializeEntities(entities: SerializableConfig[]): (EntityConfig | ChildEntityDefinition)[] {
  return entities.map(config => {
    if ('parent' in config && typeof config.parent === 'string') {
      return deserializeChildEntityConfig(config as SerializableChildEntityConfig)
    } else {
      return deserializeEntityConfig(config as SerializableEntityConfig)
    }
  })
}