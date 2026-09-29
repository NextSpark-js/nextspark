import type { EntityConfigLike } from './config'

export function createEntityCreateRoute(config: EntityConfigLike) {
  return async function EntityCreateRoute() {
    return <h1 data-probe="entity-create">Create {config.slug}</h1>
  }
}
