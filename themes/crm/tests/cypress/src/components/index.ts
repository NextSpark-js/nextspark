/**
 * CRM Theme - Cypress POM Components
 *
 * Export all generic POM classes for CRM entity testing.
 * These POMs use data-cy selectors from entities.json following
 * the convention: {slug}-{component}-{detail}
 */

export { EntityList, type EntityConfig } from './EntityList'
export { EntityForm } from './EntityForm'
export { EntityDetail, type EntityDetailConfig } from './EntityDetail'

// Default exports for convenience
import { EntityList } from './EntityList'
import { EntityForm } from './EntityForm'
import { EntityDetail } from './EntityDetail'

export default {
  EntityList,
  EntityForm,
  EntityDetail,
}
