/**
 * Default Theme - Cypress POM Exports
 *
 * Centralized exports for all Default theme Page Object Models and helpers.
 *
 * Architecture (v2.0):
 * - core/: Base classes (BasePOM, DashboardEntityPOM, BlockEditorBasePOM, AuthPOM)
 * - entities/: Entity POMs extending DashboardEntityPOM (TasksPOM, CustomersPOM, etc.)
 * - features/: Feature POMs for complex UIs (PageBuilderPOM, PostEditorPOM)
 * - helpers/: Utility classes (ApiInterceptor)
 *
 * Usage:
 *   // New architecture (recommended)
 *   import { TasksPOM, CustomersPOM, AuthPOM, PageBuilderPOM } from '../src'
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
// ENTITIES - Entity POMs (extend DashboardEntityPOM)
// New instance-based POMs - use .create() factory method
// ============================================
export {
  TasksPOM as TasksPOMv2,
  CustomersPOM as CustomersPOMv2,
  PostsPOM as PostsPOMv2,
  PagesPOM as PagesPOMv2,
  type TaskFormData,
  type CustomerFormData,
  type PostListFilters,
  type PageListFilters
} from './entities'

// ============================================
// FEATURES - Feature POMs (block editors, public pages)
// New instance-based POMs - use .create() factory method
// ============================================
export {
  PageBuilderPOM as PageBuilderPOMv2,
  PostEditorPOM as PostEditorPOMv2,
  AdminTeamRolesPOM,
  PublicPagePOM,
  PublicPostPOM,
  type PageFormData,
  type PostFormData,
  type PageBlockData,
  type PostBlockData,
  type RoleHierarchy
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
} from './session-helpers'

// ============================================
// LEGACY/STATIC POMs (backward compatible - use v2 for new code)
// These use static methods and work with existing tests
// ============================================
export { TasksPOM } from './components/TasksPOM'
export { CustomersPOM } from './components/CustomersPOM'
export { PageBuilderPOM } from './components/PageBuilderPOM'
export { PostEditorPOM } from './components/PostEditorPOM'
export { PostsListPOM } from './components/PostsListPOM'
export { CategoriesPOM } from './components/CategoriesPOM'

// Generic entity components
export { EntityList } from './components/EntityList'
export { EntityForm } from './components/EntityForm'
