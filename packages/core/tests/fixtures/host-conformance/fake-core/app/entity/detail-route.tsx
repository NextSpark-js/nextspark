import type { ComponentType } from 'react'
import type { EntityConfigLike } from './config'

export function createEntityDetailRoute(
  config: EntityConfigLike,
  childEntityNames: string[],
  Template?: ComponentType<{ params: Promise<{ entity: string; id: string }> }>
) {
  return async function EntityDetailRoute({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    if (Template) return <Template params={Promise.resolve({ entity: config.slug, id })} />
    return (
      <h1 data-probe={`entity-detail-${id}`}>
        Entity detail: {config.slug} {id} ({childEntityNames.join(',') || 'no children'})
      </h1>
    )
  }
}
