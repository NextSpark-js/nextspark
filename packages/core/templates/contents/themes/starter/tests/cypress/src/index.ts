/**
 * Starter Theme - Cypress POM Exports
 *
 * Centralized exports for all Starter theme Page Object Models and helpers.
 *
 * Architecture:
 * - core/: Base classes (BasePOM, DashboardEntityPOM, BlockEditorBasePOM, AuthPOM)
 * - components/: Generic UI components (EntityForm, EntityList, TeamSwitcherPOM)
 * - entities/: Entity POMs extending DashboardEntityPOM (TasksPOM)
 * - features/: Feature POMs (DashboardPOM, SettingsPOM, SuperadminPOM, etc.)
 * - helpers/: Utility classes (ApiInterceptor)
 *
 * Usage:
 *   import { TasksPOM, AuthPOM, DashboardPOM } from '../src'
 *   const tasks = TasksPOM.create()
 *   tasks.visitList().waitForList().clickAdd()
 *
 *   // Session helpers
 *   import { loginAsOwner, loginAsMember } from '../src'
 */

// ============================================
// CORE - Base Classes
// ============================================
export {
  BasePOM,
  DashboardEntityPOM,
  BlockEditorBasePOM,
  AuthPOM,
  type EntityConfig,
  type SignupData
} from './core'

// ============================================
// COMPONENTS - Generic UI Components
// ============================================
export {
  EntityList,
  EntityForm,
  TeamSwitcherPOM,
  DevKeyringPOM,
  type EntityListConfig,
  type EntityFormConfig
} from './components'

// ============================================
// ENTITIES - Entity POMs (extend DashboardEntityPOM)
// ============================================
export {
  TasksPOM,
  type TaskFormData
} from './entities'

// ============================================
// FEATURES - Feature POMs
// ============================================
export {
  DashboardPOM,
  SettingsPOM,
  SuperadminPOM,
  BillingPOM,
  DevtoolsPOM,
  ScheduledActionsPOM
} from './features'

// ============================================
// HELPERS
// ============================================
export { ApiInterceptor, type ApiInterceptorConfig } from './helpers/ApiInterceptor'

// ============================================
// SESSION HELPERS
// ============================================
export {
  DEFAULT_THEME_USERS,
  loginAsDefaultOwner,
  loginAsDefaultAdmin,
  loginAsDefaultMember,
  loginAsDefaultEditor,
  loginAsDefaultViewer,
  loginAsOwner,
  loginAsMember,
  loginAsAdmin,
  loginAsEditor,
  loginAsViewer,
  loginAsDefaultDeveloper,
  loginAsDefaultSuperadmin,
} from './session-helpers'
