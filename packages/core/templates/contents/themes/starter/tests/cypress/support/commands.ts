/**
 * Custom Cypress Commands for Starter Theme
 *
 * Add custom commands here that can be used across all tests.
 * Commands are available via cy.commandName()
 *
 * @example
 * // Define a command
 * Cypress.Commands.add('login', (email, password) => { ... })
 *
 * // Use it in tests
 * cy.login('user@example.com', 'password')
 */

// Declare custom commands for TypeScript
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Login with email and password
       */
      login(email: string, password: string): Chainable<void>

      /**
       * Login as a specific role using DevKeyring users
       * @param role - 'owner' | 'admin' | 'member' | 'viewer'
       */
      loginAs(role: 'owner' | 'admin' | 'member' | 'viewer'): Chainable<void>

      /**
       * Login as owner using session helpers
       */
      loginAsOwner(): Chainable<void>

      /**
       * Login as member using session helpers
       */
      loginAsMember(): Chainable<void>

      /**
       * Login as admin using session helpers
       */
      loginAsAdmin(): Chainable<void>

      /**
       * Login as viewer using session helpers
       */
      loginAsViewer(): Chainable<void>

      /**
       * Logout from the application
       */
      logout(): Chainable<void>

      /**
       * Create a task via API
       */
      createTask(data: {
        title: string
        description?: string
        status?: string
        priority?: string
      }): Chainable<Cypress.Response<unknown>>

      /**
       * Delete a task via API
       */
      deleteTask(id: string): Chainable<Cypress.Response<unknown>>
    }
  }
}

// Import session helpers for login commands
import {
  loginAsOwner,
  loginAsMember,
  loginAsAdmin,
  loginAsViewer,
  THEME_USERS,
} from '../src/session-helpers'

// Test password
const TEST_PASSWORD = 'Test1234'

// Register login commands
Cypress.Commands.add('loginAsOwner', loginAsOwner)
Cypress.Commands.add('loginAsMember', loginAsMember)
Cypress.Commands.add('loginAsAdmin', loginAsAdmin)
Cypress.Commands.add('loginAsViewer', loginAsViewer)

/**
 * Login with email and password via API
 */
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.request({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    body: { email, password },
    failOnStatusCode: false,
  }).then((response) => {
    if (response.status === 200) {
      cy.visit('/dashboard')
      cy.url().should('include', '/dashboard')
    } else {
      throw new Error(`Login failed: ${response.body?.error || 'Unknown error'}`)
    }
  })
})

/**
 * Login as a specific role
 */
Cypress.Commands.add('loginAs', (role: 'owner' | 'admin' | 'member' | 'viewer') => {
  const roleMap = {
    owner: loginAsOwner,
    admin: loginAsAdmin,
    member: loginAsMember,
    viewer: loginAsViewer,
  }

  const loginFn = roleMap[role]
  if (loginFn) {
    loginFn()
  } else {
    throw new Error(`Unknown role: ${role}`)
  }
})

/**
 * Logout from the application
 */
Cypress.Commands.add('logout', () => {
  cy.request({
    method: 'POST',
    url: '/api/auth/sign-out',
    failOnStatusCode: false,
  })
  cy.clearCookies()
  cy.clearLocalStorage()
})

/**
 * Create a task via API
 */
Cypress.Commands.add('createTask', (data) => {
  return cy.window().then((win) => {
    const teamId = win.localStorage.getItem('activeTeamId')
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (teamId) {
      headers['x-team-id'] = teamId
    }

    return cy.request({
      method: 'POST',
      url: '/api/v1/tasks',
      headers,
      body: {
        title: data.title,
        description: data.description || '',
        status: data.status || 'todo',
        priority: data.priority || 'medium',
      },
      failOnStatusCode: false,
    })
  })
})

/**
 * Delete a task via API
 */
Cypress.Commands.add('deleteTask', (id: string) => {
  return cy.window().then((win) => {
    const teamId = win.localStorage.getItem('activeTeamId')
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (teamId) {
      headers['x-team-id'] = teamId
    }

    return cy.request({
      method: 'DELETE',
      url: `/api/v1/tasks/${id}`,
      headers,
      failOnStatusCode: false,
    })
  })
})

export {}
