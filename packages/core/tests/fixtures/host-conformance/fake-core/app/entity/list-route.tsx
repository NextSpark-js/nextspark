import type { ComponentType } from 'react'
import type { EntityConfigLike } from './config'

export function createEntityListRoute(config: EntityConfigLike, Template?: ComponentType<{ params: Promise<{ entity: string }> }>) {
  return async function EntityListRoute() {
    if (Template) return <Template params={Promise.resolve({ entity: config.slug })} />
    return <h1 data-probe="entity-list">Entity list: {config.slug}</h1>
  }
}
