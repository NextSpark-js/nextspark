import { Suspense, type ReactNode } from 'react'
import type { EntityConfigLike } from './config'

export function createEntityLayoutRoute(config: EntityConfigLike) {
  return async function EntityLayoutRoute({ children }: { children: ReactNode }) {
    return (
      <section data-probe="entity-layout" data-entity={config.slug}>
        <Suspense fallback={<p>Loading…</p>}>{children}</Suspense>
      </section>
    )
  }
}
