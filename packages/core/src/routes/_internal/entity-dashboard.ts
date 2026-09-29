import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'

/** Whether the entity's dashboard routes are served: enabled, and shown in the dashboard menu. */
export function isDashboardEntity(config: EntityConfig): boolean {
  return Boolean(config.enabled) && Boolean(config.ui?.dashboard?.showInMenu)
}

/**
 * Whether the entity's create and edit pages are served: not disabled and not hidden from the dashboard menu
 * (the client registry's `features`: `enabled !== false`, `showInMenu !== false`).
 */
export function isManageableEntity(config: EntityConfig): boolean {
  return config.enabled !== false && config.ui?.dashboard?.showInMenu !== false
}
