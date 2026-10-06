/**
 * The dashboard edit page of one entity for a host with `cacheComponents` on: the route of
 * entity-edit-route behind a Suspense boundary (see suspended-route.tsx).
 */
import { behindSuspense } from './suspended-route'
import { createEntityEditRoute as createRoute } from './entity-edit-route'

export type { EntityEditTemplateProps } from './entity-edit-route'

export function createEntityEditRoute(...args: Parameters<typeof createRoute>) {
  return behindSuspense(createRoute(...args))
}
