/**
 * Starter Theme - Components Index
 *
 * Export all POM components for the Starter theme.
 */

// Generic POMs (entity-agnostic)
export { EntityList, type EntityConfig as EntityListConfig } from './EntityList'
export { EntityForm, type EntityConfig as EntityFormConfig } from './EntityForm'

// Feature Component POMs (multi-tenant, auth)
export { TeamSwitcherPOM } from './TeamSwitcherPOM'
export { DevKeyringPOM } from './DevKeyringPOM'
