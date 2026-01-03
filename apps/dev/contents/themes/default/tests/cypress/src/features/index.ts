/**
 * Feature POM exports
 *
 * Specialized POMs for complex features:
 * - PageBuilderPOM: Create/edit pages with blocks
 * - PostEditorPOM: Create/edit posts with blocks
 * - PublicPagePOM: Test public page rendering
 * - PublicPostPOM: Test public post rendering
 * - AdminTeamRolesPOM: Admin team roles matrix
 * - DashboardPOM: Dashboard navigation and shell
 * - SettingsPOM: Settings area (profile, team, billing)
 * - AdminPOM: Superadmin area
 * - BillingPOM: Billing settings
 * - DevtoolsPOM: Developer tools area
 */

export { PageBuilderPOM, type PageFormData, type BlockData as PageBlockData } from './PageBuilderPOM'
export { PostEditorPOM, type PostFormData, type BlockData as PostBlockData } from './PostEditorPOM'
export { AdminTeamRolesPOM, type RoleHierarchy } from './AdminTeamRolesPOM'
export { DashboardPOM } from './DashboardPOM'
export { SettingsPOM } from './SettingsPOM'
export { AdminPOM } from './AdminPOM'
export { BillingPOM } from './BillingPOM'
export { DevtoolsPOM } from './DevtoolsPOM'

// Re-export public POMs from components (until migrated)
export { PublicPagePOM } from '../components/PublicPagePOM'
export { PublicPostPOM } from '../components/PublicPostPOM'
