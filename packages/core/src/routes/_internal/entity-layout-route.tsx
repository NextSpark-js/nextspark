/**
 * The permission layout of one entity's dashboard routes, for the generated host (#203). See
 * entity-list-route.tsx for how the per-entity routes are made: one factory per module, so a route's
 * module graph holds only the client components its own page renders.
 */

import { EntityPermissionLayout } from './entity-permission-layout'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'

/**
 * @param config - the entity's config
 */
export function createEntityLayoutRoute(config: EntityConfig) {
  return async function EntityLayoutRoute({ children }: { children: React.ReactNode }) {
    return <EntityPermissionLayout entity={config.slug}>{children}</EntityPermissionLayout>
  }
}
