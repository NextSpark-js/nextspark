/**
 * The client-safe view of an entity config that the builder editor and the create/edit forms take
 * (`ClientEntityConfig`), derived from the config itself. The generated `entity-registry.client` builds the
 * same object for every entity at once, importing all of their configs; here it is built for one config that
 * is already in the client (hydrated by the dashboard shell), so no other entity's code comes with it.
 */

import type { ClientEntityConfig } from '@nextsparkjs/registries/entity-registry.client'
import type { EntityConfig } from './types'

export function toClientEntityConfig(config: EntityConfig): ClientEntityConfig {
  return {
    name: config.slug,
    apiPath: config.slug,
    tableName: config.slug,
    displayName: config.names?.singular || config.slug,
    relativePath: config.slug,
    depth: 0,
    parent: null,
    children: [],
    hasComponents: false,
    hasHooks: false,
    hasMigrations: false,
    hasMessages: false,
    hasAssets: false,
    messagesPath: '',
    pluginContext: null,
    themeContext: null,
    isCore: false,
    source: 'project',
    access: config.access?.basePath ? { basePath: config.access.basePath } : undefined,
    features: {
      enabled: config.enabled !== false,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      searchable: true,
      showInMenu: config.ui?.dashboard?.showInMenu !== false,
    },
    builder: config.builder
      ? {
          enabled: config.builder.enabled,
          sidebarFields: config.builder.sidebarFields,
          sidebarFieldsConfig: config.builder.sidebarFieldsConfig,
          showSlug: config.builder.showSlug,
          public: config.builder.public,
          seo: config.builder.seo,
        }
      : undefined,
    taxonomies: config.taxonomies ? { enabled: config.taxonomies.enabled, types: config.taxonomies.types } : undefined,
  } as unknown as ClientEntityConfig
}
