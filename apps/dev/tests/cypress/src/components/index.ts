/**
 * Default Theme - Components Index
 *
 * Export all POM components for the Default theme.
 */

// Generic POMs (entity-agnostic)
export { EntityList, type EntityConfig as EntityListConfig } from './EntityList'
export { EntityForm, type EntityConfig as EntityFormConfig } from './EntityForm'

// Entity-specific POMs (using new convention)
export { TasksPOM, type TaskFormData } from './TasksPOM'
export { CustomersPOM, type CustomerFormData } from './CustomersPOM'

// Page Builder POMs
export { PageBuilderPOM, type PageFormData, type BlockData } from './PageBuilderPOM'
export { PublicPagePOM, type PageData } from './PublicPagePOM'

// Feature Component POMs (multi-tenant, auth)
export { TeamSwitcherPOM } from './TeamSwitcherPOM'
export { DevKeyringPOM } from './DevKeyringPOM'
