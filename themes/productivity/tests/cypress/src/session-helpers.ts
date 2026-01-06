/**
 * Productivity Theme Session Helpers
 *
 * Direct login functions for Productivity theme tests using theme-specific users.
 * These helpers don't depend on ACTIVE_THEME environment variable.
 */

import { DevKeyring } from '../../../../../../test/cypress/src/classes/components/auth/DevKeyring.js'

/**
 * Productivity Test Users - from app.config.ts devKeyring
 */
export const PRODUCTIVITY_USERS = {
  OWNER: 'prod_owner_patricia@nextspark.dev', // Patricia Torres - Product Team (owner), Marketing Hub (owner)
  ADMIN: 'prod_admin_member_lucas@nextspark.dev', // Lucas Luna - Product Team (admin), Marketing Hub (member)
  MEMBER_PRODUCT: 'prod_member_diana@nextspark.dev', // Diana Rios - Product Team (member)
  MEMBER_MARKETING: 'prod_member_marcos@nextspark.dev', // Marcos Silva - Marketing Hub (member)
} as const

/**
 * Login as Productivity Owner (Patricia Torres)
 * Has owner role in Product Team and Marketing Hub
 * Session is cached and reused across tests
 */
export function loginAsProductivityOwner() {
  cy.session('productivity-owner-session', () => {
    cy.visit('/login')
    const devKeyring = new DevKeyring()
    devKeyring.validateVisible()
    devKeyring.quickLoginByEmail(PRODUCTIVITY_USERS.OWNER)
    cy.url().should('include', '/dashboard')
  }, {
    validate: () => {
      cy.visit('/dashboard')
      cy.url().should('include', '/dashboard')
    }
  })
}

/**
 * Login as Productivity Admin (Lucas Luna)
 * Has admin role in Product Team, member role in Marketing Hub
 * Session is cached and reused across tests
 */
export function loginAsProductivityAdmin() {
  cy.session('productivity-admin-session', () => {
    cy.visit('/login')
    const devKeyring = new DevKeyring()
    devKeyring.validateVisible()
    devKeyring.quickLoginByEmail(PRODUCTIVITY_USERS.ADMIN)
    cy.url().should('include', '/dashboard')
  }, {
    validate: () => {
      cy.visit('/dashboard')
      cy.url().should('include', '/dashboard')
    }
  })
}

/**
 * Login as Productivity Member - Product Team (Diana Rios)
 * Has member role in Product Team only
 * Session is cached and reused across tests
 */
export function loginAsProductivityMember() {
  cy.session('productivity-member-session', () => {
    cy.visit('/login')
    const devKeyring = new DevKeyring()
    devKeyring.validateVisible()
    devKeyring.quickLoginByEmail(PRODUCTIVITY_USERS.MEMBER_PRODUCT)
    cy.url().should('include', '/dashboard')
  }, {
    validate: () => {
      cy.visit('/dashboard')
      cy.url().should('include', '/dashboard')
    }
  })
}

/**
 * Login as Productivity Member - Marketing Hub (Marcos Silva)
 * Has member role in Marketing Hub only
 * Session is cached and reused across tests
 */
export function loginAsProductivityMemberMarketing() {
  cy.session('productivity-member-marketing-session', () => {
    cy.visit('/login')
    const devKeyring = new DevKeyring()
    devKeyring.validateVisible()
    devKeyring.quickLoginByEmail(PRODUCTIVITY_USERS.MEMBER_MARKETING)
    cy.url().should('include', '/dashboard')
  }, {
    validate: () => {
      cy.visit('/dashboard')
      cy.url().should('include', '/dashboard')
    }
  })
}

/**
 * Alias for loginAsProductivityOwner (convenience function)
 */
export function loginAsOwner() {
  return loginAsProductivityOwner()
}
