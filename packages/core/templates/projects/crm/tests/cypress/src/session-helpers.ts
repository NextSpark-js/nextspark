/**
 * CRM Theme Session Helpers
 *
 * Direct login functions for CRM theme tests using CRM-specific users.
 * Uses API-based login for faster and more stable authentication.
 */

/**
 * CRM Test Users - hardcoded for CRM theme tests
 */
export const CRM_USERS = {
  OWNER: 'crm_owner_roberto@nextspark.dev',   // CEO
  ADMIN: 'crm_admin_sofia@nextspark.dev',     // Sales Manager
  MEMBER: 'crm_member_miguel@nextspark.dev',  // Sales Rep
  LAURA: 'crm_member_laura@nextspark.dev',    // Marketing
} as const

// Default test password
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
 * Login as CRM Owner (CEO)
 * Session is cached and reused across tests
 */
export function loginAsCrmOwner() {
  cy.session('crm-owner-session', () => {
    apiLogin(CRM_USERS.OWNER).then((success) => {
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
 * Login as CRM Admin (Sales Manager)
 * Session is cached and reused across tests
 */
export function loginAsCrmAdmin() {
  cy.session('crm-admin-session', () => {
    apiLogin(CRM_USERS.ADMIN).then((success) => {
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
 * Login as CRM Member (Sales Rep)
 * Session is cached and reused across tests
 */
export function loginAsCrmMember() {
  cy.session('crm-member-session', () => {
    apiLogin(CRM_USERS.MEMBER).then((success) => {
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
 * Login as CRM Laura (Marketing)
 * Session is cached and reused across tests
 */
export function loginAsCrmLaura() {
  cy.session('crm-laura-session', () => {
    apiLogin(CRM_USERS.LAURA).then((success) => {
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
export const loginAsOwner = loginAsCrmOwner
export const loginAsAdmin = loginAsCrmAdmin
export const loginAsMember = loginAsCrmMember
