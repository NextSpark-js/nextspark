import type { EntityConfigLike } from './config'

export function createEntityEditRoute(config: EntityConfigLike) {
  return async function EntityEditRoute({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    return <h1 data-probe={`entity-edit-${id}`}>Edit {config.slug} {id}</h1>
  }
}
