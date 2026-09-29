/**
 * Client-side entity metadata, read from the dashboard's own registry.
 *
 * The dashboard shell hydrates `registry.client` synchronously from the entity list its server layout sends as
 * props (DashboardShell), before any page renders. Client code that needs an entity's API path, its operations or
 * its parent/child relation reads it there instead of importing the generated `entity-registry.client`, which
 * imports the config of every entity: a route that renders a form or a list would carry every entity's code, and
 * grow with each entity added.
 *
 * The generated registry stays for the few modules that want it (patterns pages); nothing here imports it.
 */

import { clientEntityRegistry } from './registry.client'
import type { EntityConfig } from './types'

/** What client code needs of an entity to build its API calls (the shape `clientMetaSystemAdapter` returned). */
export interface ClientEntityApiConfig {
  name: string
  apiPath: string
  features: { enabled: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }
}

export function toClientEntityApiConfig(config: EntityConfig): ClientEntityApiConfig {
  return {
    name: config.slug,
    apiPath: config.slug,
    features: { enabled: config.enabled !== false, canCreate: true, canEdit: true, canDelete: true },
  }
}

/** The dashboard's entities, as API configs. Empty until the dashboard shell has hydrated the registry. */
export function getClientEntityConfigs(): ClientEntityApiConfig[] {
  return clientEntityRegistry.getAll().map(toClientEntityApiConfig)
}

/**
 * Parent/child relation of an entity type: a child's type is `<parent>_<child>`, with the parent a registered
 * entity (the longest match wins); its API is reached through the parent, so it has no API path of its own.
 */
export function parseClientChildEntity(entityType: string): { isChild: boolean; parentEntity?: string; childType?: string } {
  let parent: string | undefined
  for (const { slug } of clientEntityRegistry.getAll()) {
    if (entityType.startsWith(`${slug}_`) && (!parent || slug.length > parent.length)) parent = slug
  }
  if (!parent) return { isChild: false }
  return { isChild: true, parentEntity: parent, childType: `${entityType.slice(parent.length + 1)}s` }
}

/**
 * The API path of an entity: its slug (the generated registry's `apiPath` is `slug`). An entity the registry does
 * not know is still reached at its own name, which is what its slug is; a child entity has none.
 */
export function getClientEntityApiPath(entityType: string): string | null {
  if (parseClientChildEntity(entityType).isChild) return null
  return clientEntityRegistry.get(entityType)?.slug ?? entityType
}
