/**
 * Blog Theme Session Helpers
 *
 * Isolated login helpers for blog theme tests.
 * Uses cy.session() for cached authentication sessions.
 *
 * Theme Mode: single-user (isolated blogs, no team collaboration)
 */

import { DevKeyring } from '../../../../../../test/cypress/src/classes/components/auth/DevKeyring.js'

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

/**
 * Login as a blog author
 * Session is cached and reused across tests for optimal performance
 *
 * @param author - Author key (MARCOS, LUCIA, or CARLOS)
 */
export function loginAsBlogAuthor(author: BlogAuthor = 'MARCOS') {
  const user = BLOG_USERS[author]

  cy.session(`blog-author-${author.toLowerCase()}`, () => {
    cy.visit('/login')
    const devKeyring = new DevKeyring()
    devKeyring.validateVisible()
    devKeyring.quickLoginByEmail(user.email)
    cy.url().should('include', '/dashboard')
  }, {
    validate: () => {
      cy.visit('/dashboard')
      cy.url().should('include', '/dashboard')
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
    cy.visit('/login')
    const devKeyring = new DevKeyring()
    devKeyring.validateVisible()
    devKeyring.quickLoginByEmail(email)
    cy.url().should('include', '/dashboard')
  }, {
    validate: () => {
      cy.visit('/dashboard')
      cy.url().should('include', '/dashboard')
    }
  })
}
