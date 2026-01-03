/**
 * CRM Theme - Main Export Index
 *
 * Exports all CRM theme POM classes:
 * - Generic components (EntityList, EntityForm, EntityDetail)
 * - Entity-specific POMs (PipelinesPOM, OpportunitiesPOM, etc.)
 * - API Controllers (TypeScript ES modules)
 *
 * Usage:
 *   import { PipelinesPOM, EntityList } from '../classes/themes/crm'
 *   import { ActivityAPIController } from '../classes/themes/crm/controllers'
 */

// Generic Components (Entity Testing Convention)
export {
  EntityList,
  EntityForm,
  EntityDetail,
  type EntityConfig,
  type EntityDetailConfig,
} from './components'

// Entity-specific POMs
export {
  PipelinesPOM,
  OpportunitiesPOM,
  LeadsPOM,
  ContactsPOM,
  CompaniesPOM,
  ActivitiesPOM,
} from './entities'

// Session helpers
export {
  loginAsCrmOwner,
  loginAsCrmAdmin,
  loginAsCrmMember,
  loginAsCrmLaura,
  CRM_USERS,
} from './session-helpers'

// API Controllers (TypeScript ES modules)
// Usage: import { ActivityAPIController } from '../classes/themes/crm/controllers'
//
// Available controllers:
// - BaseAPIController (abstract base class)
// - ActivityAPIController
// - LeadAPIController
// - ProductAPIController
// - PipelineAPIController
// - ContactAPIController
// - CampaignAPIController
// - CompanyAPIController
// - OpportunityAPIController
// - NoteAPIController
//
// All controllers extend BaseAPIController and provide:
// - CRUD operations (getAll, getById, create, update, delete)
// - createTestRecord() with retry support
// - validateObject() for response validation
// - Entity-specific methods (complete, pin, closeAsWon, etc.)

// Re-export default objects for namespace imports
import * as Components from './components'
import * as Entities from './entities'
import * as Controllers from './controllers'

export { Components, Entities, Controllers }
