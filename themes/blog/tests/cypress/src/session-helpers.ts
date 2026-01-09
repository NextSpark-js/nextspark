/**
 * Blog Theme Session Helpers
 *
 * Isolated login helpers for blog theme tests.
 * Uses cy.session() for cached authentication sessions.
 * Uses API-based login for faster and more stable authentication.
 *
 * Theme Mode: single-user (isolated blogs, no team collaboration)
 */

/**
 * Blog theme test users
 * Each user owns their own individual blog
 */
export const BLOG_USERS = {
  MARCOS: {
    email: 'blog_author_marcos@nextspark.dev',
    password: 'Test1234',
    name: 'Marcos Tech'
  },
  LUCIA: {
    email: 'blog_author_lucia@nextspark.dev',
    password: 'Test1234',
    name: 'Lucia Lifestyle'
  },
  CARLOS: {
    email: 'blog_author_carlos@nextspark.dev',
    password: 'Test1234',
    name: 'Carlos Finance'
  }
} as const

export type BlogAuthor = keyof typeof BLOG_USERS

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
 * Setup team context after login (blog theme uses personal teams)
 */
function setupTeamContext() {
  cy.request({
    method: 'GET',
    url: '/api/v1/teams',
    timeout: API_TIMEOUT,
    failOnStatusCode: false
  }).then((teamsResponse) => {
    if (teamsResponse.status === 200 && teamsResponse.body?.data?.length > 0) {
      const teams = teamsResponse.body.data
      const selectedTeam = teams[0]
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
 * Login as a blog author
 * Session is cached and reused across tests for optimal performance
 *
 * @param author - Author key (MARCOS, LUCIA, or CARLOS)
 */
export function loginAsBlogAuthor(author: BlogAuthor = 'MARCOS') {
  const user = BLOG_USERS[author]

  cy.session(`blog-author-${author.toLowerCase()}`, () => {
    apiLogin(user.email, user.password).then((success) => {
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
 * Alias for loginAsBlogAuthor('MARCOS')
 * Default owner for blog theme tests
 */
export function loginAsOwner() {
  return loginAsBlogAuthor('MARCOS')
}

/**
 * Login with a specific blog user email
 * Useful for custom test scenarios
 *
 * @param email - User email to login with
 * @param sessionName - Unique session name for caching
 */
export function loginWithBlogEmail(email: string, sessionName?: string) {
  const name = sessionName || `blog-session-${email.split('@')[0]}`

  cy.session(name, () => {
    apiLogin(email).then((success) => {
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
