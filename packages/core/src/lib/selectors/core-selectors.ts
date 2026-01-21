/**
 * Core Selectors
 *
 * Single source of truth for all data-cy selectors in core components.
 * Themes can import and extend these selectors.
 *
 * This file composes all domain-specific selectors into a single export.
 * Individual domain selectors are in ./domains/ for better maintainability.
 *
 * Naming conventions:
 * - Static selectors: "domain-element" (e.g., "nav-main", "login-form")
 * - Dynamic selectors: "domain-element-{placeholder}" (e.g., "{slug}-row-{id}")
 *
 * Placeholders:
 * - {slug} - Entity slug (customers, tasks, pages, posts)
 * - {id} - Record ID
 * - {name} - Field name
 * - {section} - Settings section name
 * - {action} - Action name (edit, delete, view)
 * - {value} - Filter/option value
 * - {index} - Array index
 * - {mode} - View mode (view, edit, create)
 */

import { AUTH_SELECTORS } from './domains/auth.selectors'
import { DASHBOARD_SELECTORS } from './domains/dashboard.selectors'
import { ENTITIES_SELECTORS } from './domains/entities.selectors'
import { GLOBAL_SEARCH_SELECTORS } from './domains/global-search.selectors'
import { TAXONOMIES_SELECTORS } from './domains/taxonomies.selectors'
import { TEAMS_SELECTORS } from './domains/teams.selectors'
import { BLOCK_EDITOR_SELECTORS } from './domains/block-editor.selectors'
import { SETTINGS_SELECTORS } from './domains/settings.selectors'
import { SUPERADMIN_SELECTORS } from './domains/superadmin.selectors'
import { DEVTOOLS_SELECTORS } from './domains/devtools.selectors'
import { PUBLIC_SELECTORS } from './domains/public.selectors'
import { COMMON_SELECTORS } from './domains/common.selectors'
import { PATTERNS_SELECTORS } from './domains/patterns.selectors'

/**
 * CORE_SELECTORS - Composed from all domain selectors
 *
 * Structure:
 * - auth: Authentication (login, signup, forgot/reset password)
 * - dashboard: Shell, topnav, sidebar, navigation
 * - entities: Dynamic CRUD selectors with {slug} placeholders
 * - globalSearch: Cmd+K search modal
 * - taxonomies: Categories, tags management
 * - teams: Team switcher, members, invitations
 * - blockEditor: Page builder (7 components)
 * - settings: User/team settings, billing, API keys
 * - superadmin: Admin panel
 * - devtools: Developer tools
 * - public: Public pages, navbar, footer
 * - common: Shared components (modals, toasts, loading)
 * - patterns: Pattern usage, delete dialog, placeholders
 */
export const CORE_SELECTORS = {
  auth: AUTH_SELECTORS,
  dashboard: DASHBOARD_SELECTORS,
  entities: ENTITIES_SELECTORS,
  globalSearch: GLOBAL_SEARCH_SELECTORS,
  taxonomies: TAXONOMIES_SELECTORS,
  teams: TEAMS_SELECTORS,
  blockEditor: BLOCK_EDITOR_SELECTORS,
  settings: SETTINGS_SELECTORS,
  superadmin: SUPERADMIN_SELECTORS,
  devtools: DEVTOOLS_SELECTORS,
  public: PUBLIC_SELECTORS,
  common: COMMON_SELECTORS,
  patterns: PATTERNS_SELECTORS,
} as const

/**
 * Type for the CORE_SELECTORS object
 */
export type CoreSelectorsType = typeof CORE_SELECTORS

// Re-export individual domain selectors for direct imports
export * from './domains'
