'use client'

import type { ReactNode } from 'react'
import { deserializeEntityConfig, type SerializableEntityConfig } from '../../../lib/entities/serialization'
import { setServerEntities } from '../../../lib/entities/registry.client'

// Module-level flag to track hydration (survives re-renders)
let clientHydrated = false

/**
 * Fills the client entity registry from the server's entity list, once.
 * Runs during render, before children mount, so `useEntityConfig` sees a populated registry.
 */
export function hydrateEntityRegistry(entities: SerializableEntityConfig[]): void {
  if (clientHydrated || entities.length === 0) return
  setServerEntities(entities.map(deserializeEntityConfig))
  clientHydrated = true
}

/**
 * For a dashboard layout that replaces `DashboardShell` (a project's own sidebar and top bar): without it the client
 * registry stays empty and the entity pages answer `Entity "<slug>" not found in the registry`.
 */
export function EntityRegistryHydrator({ entities, children }: { entities: SerializableEntityConfig[]; children: ReactNode }) {
  hydrateEntityRegistry(entities)
  return <>{children}</>
}
