/**
 * Theme Session Helpers Template
 *
 * Direct login functions for theme tests using theme-specific users.
 * These helpers don't depend on ACTIVE_THEME environment variable.
 *
 * IMPORTANT: After login, this helper sets activeTeamId in localStorage.
 * This is required because all entity API calls include x-team-id header
 * which is read from localStorage.activeTeamId.
 *
 * CONFIGURATION: Credentials can be customized via Cypress env variables:
 * - CYPRESS_DEVELOPER_EMAIL: Override developer user email
 * - CYPRESS_DEVELOPER_PASSWORD: Override developer user password
 * - CYPRESS_OWNER_EMAIL, CYPRESS_ADMIN_EMAIL, etc.: Override specific roles
 *
 * Set these in cypress.config.ts env section or via CLI:
 *   pnpm cy:open --env DEVELOPER_EMAIL=myuser@example.com,DEVELOPER_PASSWORD=MyPass123
 */

// import { DevKeyringPOM as DevKeyring } from './components/DevKeyringPOM'

/**
 * Environment-based Test Credentials
 * Fallback values use developer@nextspark.dev (pre-installed from core)
 */
const DEVELOPER_EMAIL = Cypress.env('DEVELOPER_EMAIL') || 'developer@nextspark.dev'
const DEVELOPER_PASSWORD = Cypress.env('DEVELOPER_PASSWORD') || 'Pandora1234'

/**
 * Theme Test Users
 * CUSTOMIZE: Update with your theme's test user emails or use env variables
 *
 * Default: All roles use developer@nextspark.dev for simplicity.
 * For role-specific testing, override via env variables:
 *   CYPRESS_OWNER_EMAIL, CYPRESS_ADMIN_EMAIL, etc.
 */
export const THEME_USERS = {
  OWNER: Cypress.env('OWNER_EMAIL') || DEVELOPER_EMAIL,
  ADMIN: Cypress.env('ADMIN_EMAIL') || DEVELOPER_EMAIL,
  MEMBER: Cypress.env('MEMBER_EMAIL') || DEVELOPER_EMAIL,
  VIEWER: Cypress.env('VIEWER_EMAIL') || DEVELOPER_EMAIL,
} as const

// Common password for all test users (configurable via env)
const TEST_PASSWORD = DEVELOPER_PASSWORD

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
 */
function setupTeamContext() {
  cy.request({
    method: 'GET',
    url: '/api/v1/teams',
    timeout: API_TIMEOUT,
    failOnStatusCode: false
  }).then((teamsResponse) => {
    if (teamsResponse.status === 200 && teamsResponse.body?.data?.length > 0) {
      const firstTeam = teamsResponse.body.data[0]
      const teamId = firstTeam.id

      cy.log(`✅ Setting active team: ${firstTeam.name} (${teamId})`)

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
 */
function apiLogin(email: string): Cypress.Chainable<boolean> {
  return cy.request({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    body: { email, password: TEST_PASSWORD },
    timeout: API_TIMEOUT,
    failOnStatusCode: false
  }).then((response) => {
    if (response.status === 200) {
      return true
    } else {
      cy.log(`⚠️ API login failed with status ${response.status}, falling back to UI login`)
      // Fallback to UI login if API fails
      // TODO: Implement DevKeyring fallback for your theme
      cy.visit('/login', { timeout: 60000 })
      // const devKeyring = new DevKeyring()
      // devKeyring.validateVisible()
      // devKeyring.quickLoginByEmail(email)
      return false
    }
  })
}

/**
 * Login as Owner
 * Session is cached and reused across tests
 */
export function loginAsOwner() {
  cy.session('owner-session', () => {
    apiLogin(THEME_USERS.OWNER).then((apiLoginSucceeded) => {
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

      cy.window().then((win) => {
        const teamId = win.localStorage.getItem('activeTeamId')
        expect(teamId, 'activeTeamId should exist in localStorage').to.not.be.null
        expect(teamId, 'activeTeamId should not be empty').to.not.be.empty
      })
    }
  })
}

/**
 * Login as Admin
 * Session is cached and reused across tests
 */
export function loginAsAdmin() {
  cy.session('admin-session', () => {
    apiLogin(THEME_USERS.ADMIN).then((apiLoginSucceeded) => {
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
 * Login as Member
 * Session is cached and reused across tests
 */
export function loginAsMember() {
  cy.session('member-session', () => {
    apiLogin(THEME_USERS.MEMBER).then((apiLoginSucceeded) => {
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
 * Login as Viewer
 * Session is cached and reused across tests
 */
export function loginAsViewer() {
  cy.session('viewer-session', () => {
    apiLogin(THEME_USERS.VIEWER).then((apiLoginSucceeded) => {
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
 * Returns theme users for backwards compatibility with external helper pattern.
 */
export function getThemeUsers() {
  return THEME_USERS
}
