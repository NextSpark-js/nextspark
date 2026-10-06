/**
 * The dashboard detail page of one entity for a host with `cacheComponents` on: the route of
 * entity-detail-route behind a Suspense boundary (see suspended-route.tsx).
 */
import { behindSuspense } from './suspended-route'
import { createEntityDetailRoute as createRoute } from './entity-detail-route'

export type { EntityDetailTemplateProps } from './entity-detail-route'

export function createEntityDetailRoute(...args: Parameters<typeof createRoute>) {
  return behindSuspense(createRoute(...args))
}
