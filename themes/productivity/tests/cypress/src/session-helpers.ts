/**
 * Productivity Theme Session Helpers
 *
 * Direct login functions for Productivity theme tests using theme-specific users.
 * Uses API-based login for faster and more stable authentication.
 */

/**
 * Productivity Test Users - from app.config.ts devKeyring
 */
export const PRODUCTIVITY_USERS = {
  OWNER: 'prod_owner_patricia@nextspark.dev', // Patricia Torres - Product Team (owner), Marketing Hub (owner)
  ADMIN: 'prod_admin_member_lucas@nextspark.dev', // Lucas Luna - Product Team (admin), Marketing Hub (member)
  MEMBER_PRODUCT: 'prod_member_diana@nextspark.dev', // Diana Rios - Product Team (member)
  MEMBER_MARKETING: 'prod_member_marcos@nextspark.dev', // Marcos Silva - Marketing Hub (member)
} as const

// Default test password for demo users
const TEST_PASSWORD = Cypress.env('TEST_PASSWORD') || 'Test1234'
const API_TIMEOUT = 60000

/**
 * API login helper
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
      cy.log(`⚠️ API login failed with status ${response.status}`)
      return false
    }
  })
}

/**
 * Setup team context after login
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
      let selectedTeam = teams[0]
      if (preferredRole) {
        const teamWithRole = teams.find((t: { role: string }) => t.role === preferredRole)
        if (teamWithRole) {
          selectedTeam = teamWithRole
        }
      }
      const teamId = selectedTeam.id
      cy.log(`✅ Setting active team: ${selectedTeam.name} (${teamId})`)
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
  })
}

/**
 * Login as Productivity Owner (Patricia Torres)
 * Has owner role in Product Team and Marketing Hub
 */
export function loginAsProductivityOwner() {
  cy.session('productivity-owner-session', () => {
    apiLogin(PRODUCTIVITY_USERS.OWNER).then((success) => {
      if (success) {
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
 * Login as Productivity Admin (Lucas Luna)
 * Has admin role in Product Team, member role in Marketing Hub
 */
export function loginAsProductivityAdmin() {
  cy.session('productivity-admin-session', () => {
    apiLogin(PRODUCTIVITY_USERS.ADMIN).then((success) => {
      if (success) {
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
 * Login as Productivity Member - Product Team (Diana Rios)
 * Has member role in Product Team only
 */
export function loginAsProductivityMember() {
  cy.session('productivity-member-session', () => {
    apiLogin(PRODUCTIVITY_USERS.MEMBER_PRODUCT).then((success) => {
      if (success) {
        cy.visit('/dashboard', { timeout: 60000 })
      }
      cy.url().should('include', '/dashboard')
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
 * Login as Productivity Member - Marketing Hub (Marcos Silva)
 * Has member role in Marketing Hub only
 */
export function loginAsProductivityMemberMarketing() {
  cy.session('productivity-member-marketing-session', () => {
    apiLogin(PRODUCTIVITY_USERS.MEMBER_MARKETING).then((success) => {
      if (success) {
        cy.visit('/dashboard', { timeout: 60000 })
      }
      cy.url().should('include', '/dashboard')
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

// Aliases for convenience
export const loginAsOwner = loginAsProductivityOwner
export const loginAsAdmin = loginAsProductivityAdmin
export const loginAsMember = loginAsProductivityMember
