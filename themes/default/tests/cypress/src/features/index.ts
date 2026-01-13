/**
 * Feature POM exports
 *
 * Specialized POMs for complex features:
 * - DashboardPOM: Dashboard navigation and shell
 * - SettingsPOM: Settings area (profile, team, billing)
 * - SuperadminPOM: Superadmin area
 * - SuperadminTeamRolesPOM: Superadmin team roles matrix
 * - BillingPOM: Billing settings
 * - DevtoolsPOM: Developer tools area
 * - ScheduledActionsPOM: Scheduled actions devtools
 * - PageBuilderPOM: Create/edit pages with blocks
 * - PostEditorPOM: Create/edit posts with blocks
 */

export { DashboardPOM } from './DashboardPOM'
export { SettingsPOM } from './SettingsPOM'
export { SuperadminPOM } from './SuperadminPOM'
export { SuperadminTeamRolesPOM } from './SuperadminTeamRolesPOM'
export { BillingPOM } from './BillingPOM'
export { DevtoolsPOM } from './DevtoolsPOM'
export { ScheduledActionsPOM } from './ScheduledActionsPOM'
export { PageBuilderPOM } from './PageBuilderPOM'
export { PostEditorPOM } from './PostEditorPOM'

// Re-export public POMs from components (until migrated)
export { PublicPagePOM } from '../components/PublicPagePOM'
export { PublicPostPOM } from '../components/PublicPostPOM'
