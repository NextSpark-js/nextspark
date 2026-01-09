/**
 * Default Theme Session Helpers
 *
 * Direct login functions for Default theme tests using theme-specific users.
 * These helpers don't depend on ACTIVE_THEME environment variable.
 *
 * EXPERIMENTAL: Uses API-based login instead of UI login.
 * Hypothesis: API login is faster and more stable than DevKeyring UI login,
 * especially with slow dev servers (Turbopack on-demand compilation).
 *
 * Test file: cypress/e2e/_experimental/api-login-test.cy.ts
 * Fallback: If API fails, falls back to UI login with DevKeyring.
 *
 * IMPORTANT: After login, this helper sets activeTeamId in localStorage.
 * This is required because all entity API calls include x-team-id header
 * which is read from localStorage.activeTeamId (see core/lib/api/entities.ts).
 * Without this, API calls return 400 "Team context required".
 */

import { DevKeyringPOM as DevKeyring } from './components/DevKeyringPOM'

/**
 * Environment-based Test Credentials
 *
 * These can be overridden via Cypress env variables (cypress.config.ts or CLI):
 * - CYPRESS_DEVELOPER_EMAIL / CYPRESS_DEVELOPER_PASSWORD - Developer user
 * - CYPRESS_SUPERADMIN_EMAIL / CYPRESS_SUPERADMIN_PASSWORD - Superadmin user
 * - CYPRESS_OWNER_EMAIL, CYPRESS_ADMIN_EMAIL, etc. - Demo theme users
 *
 * Fallback values are the default users from core and theme sample data.
 */

// Core system user credentials (configurable via env)
const DEVELOPER_EMAIL = Cypress.env('DEVELOPER_EMAIL') || 'developer@nextspark.dev'
const DEVELOPER_PASSWORD = Cypress.env('DEVELOPER_PASSWORD') || 'Pandora1234'
const SUPERADMIN_PASSWORD = Cypress.env('SUPERADMIN_PASSWORD') || 'Pandora1234'

// Demo user password (configurable via env)
const TEST_PASSWORD = Cypress.env('TEST_PASSWORD') || 'Test1234'

/**
 * Default Theme Test Users
 * Teams: Everpoint Labs, Ironvale Global, Riverstone Ventures
 *
 * Note: These are fallback demo users. For selector tests, use CORE_USER (developer).
 */
export const DEFAULT_THEME_USERS = {
  OWNER: Cypress.env('OWNER_EMAIL') || 'carlos.mendoza@nextspark.dev',
  ADMIN: Cypress.env('ADMIN_EMAIL') || 'james.wilson@nextspark.dev',
  MEMBER: Cypress.env('MEMBER_EMAIL') || 'emily.johnson@nextspark.dev',
  EDITOR: Cypress.env('EDITOR_EMAIL') || 'diego.ramirez@nextspark.dev',
  VIEWER: Cypress.env('VIEWER_EMAIL') || 'sarah.davis@nextspark.dev',
} as const

/**
 * Core System Users (from core/migrations/090_sample_data.sql)
 * These users have special global roles, not team-based roles
 *
 * IMPORTANT: DEVELOPER is the recommended user for most tests.
 * Configurable via CYPRESS_DEVELOPER_EMAIL env variable.
 */
export const CORE_USERS = {
  SUPERADMIN: Cypress.env('SUPERADMIN_EMAIL') || 'superadmin@nextspark.dev',
  DEVELOPER: DEVELOPER_EMAIL,
} as const

// Extended timeout for dev server compilation (60s for slow cold starts)
const API_TIMEOUT = 60000

/**
 * Sets up team context after login (requires page to be loaded for localStorage access)
 *
 * This is CRITICAL for entity API calls to work:
 * 1. Fetches user's teams from /api/v1/teams
 * 2. Sets activeTeamId in localStorage (used by frontend to add x-team-id header)
 * 3. Calls /api/v1/teams/switch to set server-side team cookie
 *
 * Without this, all entity API calls return 400 "Team context required"
 *
 * @param preferredRole - Optional role to filter teams by (e.g., 'member' to select team where user is member)
 */
function setupTeamContext(preferredRole?: string) {
  cy.request({
    method: 'GET',
    url: '/api/v1/teams',
    timeout: API_TIMEOUT,
    failOnStatusCode: false
  }).then((teamsResponse) => {
    if (teamsResponse.status === 200 && teamsResponse.body?.data?.length > 0) {
      const teams = teamsResponse.body.data

      // If preferredRole specified, find team where user has that role
      let selectedTeam = teams[0]
      if (preferredRole) {
        const teamWithRole = teams.find((t: { role: string }) => t.role === preferredRole)
        if (teamWithRole) {
          selectedTeam = teamWithRole
          cy.log(`✅ Found team with role "${preferredRole}": ${selectedTeam.name}`)
        } else {
          cy.log(`⚠️ No team found with role "${preferredRole}", using first team`)
        }
      }

      const teamId = selectedTeam.id

      cy.log(`✅ Setting active team: ${selectedTeam.name} (${teamId}) - role: ${selectedTeam.role}`)

      // Set in localStorage (used by frontend buildHeaders() to add x-team-id)
      cy.window().then((win) => {
        win.localStorage.setItem('activeTeamId', teamId)
      })

      // Call teams/switch to set server-side cookie (for SSR/layouts)
      cy.request({
        method: 'POST',
        url: '/api/v1/teams/switch',
        body: { teamId },
        timeout: API_TIMEOUT,
        failOnStatusCode: false
      })
    } else {
      cy.log(`⚠️ No teams found for user, API calls requiring team context will fail`)
    }
  })
}

/**
 * Login via API (faster and more stable than UI)
 * Returns true if API login succeeded, false if fallback to UI was needed.
 *
 * @param email - User email to login
 * @param password - Optional password (defaults to TEST_PASSWORD for demo users)
 */
function apiLogin(email: string, password: string = TEST_PASSWORD): Cypress.Chainable<boolean> {
  return cy.request({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    body: { email, password },
    timeout: API_TIMEOUT,
    failOnStatusCode: false
  }).then((response) => {
    if (response.status === 200) {
      return true
    } else {
      cy.log(`⚠️ API login failed with status ${response.status}, falling back to UI login`)
      // Fallback to UI login if API fails
      cy.visit('/login', { timeout: 60000 })
      const devKeyring = new DevKeyring()
      devKeyring.validateVisible()
      devKeyring.quickLoginByEmail(email)
      return false
    }
  })
}

/**
 * Login as Default Theme Owner
 * Session is cached and reused across tests
 *
 * Flow:
 * 1. API login (or UI fallback)
 * 2. Visit dashboard to load page context
 * 3. Setup team context (sets localStorage.activeTeamId)
 */
export function loginAsDefaultOwner() {
  cy.session('default-owner-session', () => {
    apiLogin(DEFAULT_THEME_USERS.OWNER).then((apiLoginSucceeded) => {
      // If API login succeeded, we need to visit a page before setting localStorage
      if (apiLoginSucceeded) {
        cy.visit('/dashboard', { timeout: 60000 })
      }
      // URL assertion to ensure page loaded
      cy.url().should('include', '/dashboard')
      // Setup team context (requires page to be loaded for localStorage)
      setupTeamContext()
    })
  }, {
    validate: () => {
      // Validate auth session exists
      cy.request({
        url: '/api/auth/get-session',
        timeout: API_TIMEOUT,
        failOnStatusCode: false
      }).its('status').should('eq', 200)

      // Validate team context exists in localStorage
      // This ensures API calls will have x-team-id header
      cy.window().then((win) => {
        const teamId = win.localStorage.getItem('activeTeamId')
        expect(teamId, 'activeTeamId should exist in localStorage').to.not.be.null
        expect(teamId, 'activeTeamId should not be empty').to.not.be.empty
      })
    }
  })
}

/**
 * Login as Default Theme Admin
 * Session is cached and reused across tests
 */
export function loginAsDefaultAdmin() {
  cy.session('default-admin-session', () => {
    apiLogin(DEFAULT_THEME_USERS.ADMIN).then((apiLoginSucceeded) => {
      if (apiLoginSucceeded) {
        cy.visit('/dashboard', { timeout: 60000 })
      }
      cy.url().should('include', '/dashboard')
      setupTeamContext()
    })
  }, {
    validate: () => {
      cy.request({
        url: '/api/auth/get-session',
        timeout: API_TIMEOUT,
        failOnStatusCode: false
      }).its('status').should('eq', 200)
    }
  })
}

/**
 * Login as Default Theme Member
 * Session is cached and reused across tests
 *
 * Note: Emily Johnson is member of Everpoint but admin of Riverstone.
 * We explicitly select the team where she has 'member' role.
 */
export function loginAsDefaultMember() {
  cy.session('default-member-session', () => {
    apiLogin(DEFAULT_THEME_USERS.MEMBER).then((apiLoginSucceeded) => {
      if (apiLoginSucceeded) {
        cy.visit('/dashboard', { timeout: 60000 })
      }
      cy.url().should('include', '/dashboard')
      // Explicitly select team where user is member (not admin)
      setupTeamContext('member')
    })
  }, {
    validate: () => {
      cy.request({
        url: '/api/auth/get-session',
        timeout: API_TIMEOUT,
        failOnStatusCode: false
      }).its('status').should('eq', 200)
    }
  })
}

/**
 * Login as Default Theme Viewer
 * Session is cached and reused across tests
 */
export function loginAsDefaultViewer() {
  cy.session('default-viewer-session', () => {
    apiLogin(DEFAULT_THEME_USERS.VIEWER).then((apiLoginSucceeded) => {
      if (apiLoginSucceeded) {
        cy.visit('/dashboard', { timeout: 60000 })
      }
      cy.url().should('include', '/dashboard')
      setupTeamContext()
    })
  }, {
    validate: () => {
      cy.request({
        url: '/api/auth/get-session',
        timeout: API_TIMEOUT,
        failOnStatusCode: false
      }).its('status').should('eq', 200)
    }
  })
}

/**
 * Login as Default Theme Editor
 * Session is cached and reused across tests
 *
 * Editor is a custom role with limited permissions:
 * - Can view/list customers but cannot create/update/delete
 * - Cannot access Admin or Dev Zone
 */
export function loginAsDefaultEditor() {
  cy.session('default-editor-session', () => {
    apiLogin(DEFAULT_THEME_USERS.EDITOR).then((apiLoginSucceeded) => {
      if (apiLoginSucceeded) {
        cy.visit('/dashboard', { timeout: 60000 })
      }
      cy.url().should('include', '/dashboard')
      setupTeamContext()
    })
  }, {
    validate: () => {
      cy.request({
        url: '/api/auth/get-session',
        timeout: API_TIMEOUT,
        failOnStatusCode: false
      }).its('status').should('eq', 200)
    }
  })
}

/**
 * Login as Superadmin (core system user)
 * Session is cached and reused across tests
 *
 * Superadmin has global access:
 * - Full Admin access
 * - Not team-based (no setupTeamContext needed)
 */
export function loginAsDefaultSuperadmin() {
  cy.session('default-superadmin-session', () => {
    apiLogin(CORE_USERS.SUPERADMIN, SUPERADMIN_PASSWORD).then((apiLoginSucceeded) => {
      if (apiLoginSucceeded) {
        cy.visit('/superadmin', { timeout: 60000 })
      }
      // Superadmin should land on superadmin panel or dashboard
      cy.url().should('satisfy', (url: string) => {
        return url.includes('/superadmin') || url.includes('/dashboard')
      })
    })
  }, {
    validate: () => {
      cy.request({
        url: '/api/auth/get-session',
        timeout: API_TIMEOUT,
        failOnStatusCode: false
      }).its('status').should('eq', 200)
    }
  })
}

/**
 * Login as Developer (core system user)
 * Session is cached and reused across tests
 *
 * Developer has:
 * - Dev Zone access
 * - Not team-based (no setupTeamContext needed)
 */
export function loginAsDefaultDeveloper() {
  cy.session('default-developer-session', () => {
    apiLogin(CORE_USERS.DEVELOPER, DEVELOPER_PASSWORD).then((apiLoginSucceeded) => {
      if (apiLoginSucceeded) {
        cy.visit('/devtools', { timeout: 60000 })
      }
      // Developer should land on devtools or dashboard
      cy.url().should('satisfy', (url: string) => {
        return url.includes('/devtools') || url.includes('/dashboard')
      })
    })
  }, {
    validate: () => {
      cy.request({
        url: '/api/auth/get-session',
        timeout: API_TIMEOUT,
        failOnStatusCode: false
      }).its('status').should('eq', 200)
    }
  })
}

// Aliases for convenience
export const loginAsOwner = loginAsDefaultOwner
export const loginAsMember = loginAsDefaultMember
export const loginAsAdmin = loginAsDefaultAdmin
export const loginAsEditor = loginAsDefaultEditor
export const loginAsViewer = loginAsDefaultViewer
export const loginAsSuperadmin = loginAsDefaultSuperadmin
export const loginAsDeveloper = loginAsDefaultDeveloper

/**
 * Returns theme users for backwards compatibility with external helper pattern.
 * Used by tests that import { getThemeUsers } from session-helpers.
 */
export function getThemeUsers() {
  return DEFAULT_THEME_USERS
}

// ============================================================
// BILLING TEST USERS
// ============================================================

/**
 * Billing Test Users - Teams with different subscription plans
 *
 * These users/teams are used to test billing features from different plan perspectives:
 * - Free Plan: Carlos's personal team (team-personal-carlos-001)
 * - Pro Plan: Everpoint Labs (team-everpoint-001)
 * - Enterprise Plan: Ironvale Global (team-ironvale-002)
 */
export const BILLING_TEAMS = {
  FREE: {
    teamId: 'team-personal-carlos-001',
    name: 'Carlos Personal',
    planSlug: 'free',
    owner: 'carlos.mendoza@nextspark.dev'
  },
  PRO: {
    teamId: 'team-everpoint-001',
    name: 'Everpoint Labs',
    planSlug: 'pro',
    owner: 'carlos.mendoza@nextspark.dev'
  },
  ENTERPRISE: {
    teamId: 'team-ironvale-002',
    name: 'Ironvale Global',
    planSlug: 'enterprise',
    owner: 'ana.garcia@nextspark.dev'
  }
} as const

/**
 * Switch to a specific team after login
 * @param teamId - Team ID to switch to
 */
function switchToTeam(teamId: string) {
  cy.window().then((win) => {
    win.localStorage.setItem('activeTeamId', teamId)
  })

  cy.request({
    method: 'POST',
    url: '/api/v1/teams/switch',
    body: { teamId },
    timeout: API_TIMEOUT,
    failOnStatusCode: false
  })
}

/**
 * Login as Carlos and switch to Free plan team
 * Used for testing Free plan restrictions
 */
export function loginAsFreePlanUser() {
  cy.session('billing-free-plan-session', () => {
    apiLogin(BILLING_TEAMS.FREE.owner).then((apiLoginSucceeded) => {
      if (apiLoginSucceeded) {
        cy.visit('/dashboard', { timeout: 60000, failOnStatusCode: false })
      }
      cy.url().should('include', '/dashboard')
      // Switch to the Free team
      switchToTeam(BILLING_TEAMS.FREE.teamId)
    })
  }, {
    validate: () => {
      cy.request({
        url: '/api/auth/get-session',
        timeout: API_TIMEOUT,
        failOnStatusCode: false
      }).its('status').should('eq', 200)

      cy.window().then((win) => {
        const teamId = win.localStorage.getItem('activeTeamId')
        expect(teamId).to.eq(BILLING_TEAMS.FREE.teamId)
      })
    }
  })
}

/**
 * Login as Carlos and switch to Pro plan team (Everpoint)
 * Used for testing Pro plan features
 */
export function loginAsProPlanUser() {
  cy.session('billing-pro-plan-session', () => {
    apiLogin(BILLING_TEAMS.PRO.owner).then((apiLoginSucceeded) => {
      if (apiLoginSucceeded) {
        cy.visit('/dashboard', { timeout: 60000, failOnStatusCode: false })
      }
      cy.url().should('include', '/dashboard')
      // Switch to the Pro team
      switchToTeam(BILLING_TEAMS.PRO.teamId)
    })
  }, {
    validate: () => {
      cy.request({
        url: '/api/auth/get-session',
        timeout: API_TIMEOUT,
        failOnStatusCode: false
      }).its('status').should('eq', 200)

      cy.window().then((win) => {
        const teamId = win.localStorage.getItem('activeTeamId')
        expect(teamId).to.eq(BILLING_TEAMS.PRO.teamId)
      })
    }
  })
}

/**
 * Login as Ana and switch to Enterprise plan team (Ironvale)
 * Used for testing Enterprise plan features
 */
export function loginAsEnterprisePlanUser() {
  cy.session('billing-enterprise-plan-session', () => {
    // Ana is owner of Ironvale
    apiLogin(BILLING_TEAMS.ENTERPRISE.owner).then((apiLoginSucceeded) => {
      if (apiLoginSucceeded) {
        cy.visit('/dashboard', { timeout: 60000, failOnStatusCode: false })
      }
      cy.url().should('include', '/dashboard')
      // Switch to the Enterprise team
      switchToTeam(BILLING_TEAMS.ENTERPRISE.teamId)
    })
  }, {
    validate: () => {
      cy.request({
        url: '/api/auth/get-session',
        timeout: API_TIMEOUT,
        failOnStatusCode: false
      }).its('status').should('eq', 200)

      cy.window().then((win) => {
        const teamId = win.localStorage.getItem('activeTeamId')
        expect(teamId).to.eq(BILLING_TEAMS.ENTERPRISE.teamId)
      })
    }
  })
}
