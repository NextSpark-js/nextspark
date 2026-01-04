/**
 * Core POM exports
 *
 * Base classes for building Page Object Models:
 * - BasePOM: Utility methods for all POMs
 * - DashboardEntityPOM: Base for entity CRUD POMs
 * - AuthPOM: Authentication pages POM
 */

export { BasePOM } from './BasePOM'
export { DashboardEntityPOM, type EntityConfig } from './DashboardEntityPOM'
export { AuthPOM, type SignupData } from './AuthPOM'
