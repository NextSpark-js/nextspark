/**
 * CRM Theme Session Helpers
 *
 * Direct login functions for CRM theme tests using CRM-specific users.
 * These helpers don't depend on ACTIVE_THEME environment variable.
 */

import { DevKeyring } from '../../../../../../test/cypress/src/classes/components/auth/DevKeyring.js'

/**
 * CRM Test Users - hardcoded for CRM theme tests
 */
export const CRM_USERS = {
  OWNER: 'crm_owner_roberto@nextspark.dev',   // CEO
  ADMIN: 'crm_admin_sofia@nextspark.dev',     // Sales Manager
  MEMBER: 'crm_member_miguel@nextspark.dev',  // Sales Rep
  LAURA: 'crm_member_laura@nextspark.dev',    // Marketing
} as const

/**
 * Login as CRM Owner (CEO)
 * Session is cached and reused across tests
 */
export function loginAsCrmOwner() {
  cy.session('crm-owner-session', () => {
    cy.visit('/login')
    const devKeyring = new DevKeyring()
    devKeyring.validateVisible()
    devKeyring.quickLoginByEmail(CRM_USERS.OWNER)
    cy.url().should('include', '/dashboard')
  }, {
    validate: () => {
      cy.visit('/dashboard')
      cy.url().should('include', '/dashboard')
    }
  })
}

/**
 * Login as CRM Admin (Sales Manager)
 * Session is cached and reused across tests
 */
export function loginAsCrmAdmin() {
  cy.session('crm-admin-session', () => {
    cy.visit('/login')
    const devKeyring = new DevKeyring()
    devKeyring.validateVisible()
    devKeyring.quickLoginByEmail(CRM_USERS.ADMIN)
    cy.url().should('include', '/dashboard')
  }, {
    validate: () => {
      cy.visit('/dashboard')
      cy.url().should('include', '/dashboard')
    }
  })
}

/**
 * Login as CRM Member (Sales Rep)
 * Session is cached and reused across tests
 */
export function loginAsCrmMember() {
  cy.session('crm-member-session', () => {
    cy.visit('/login')
    const devKeyring = new DevKeyring()
    devKeyring.validateVisible()
    devKeyring.quickLoginByEmail(CRM_USERS.MEMBER)
    cy.url().should('include', '/dashboard')
  }, {
    validate: () => {
      cy.visit('/dashboard')
      cy.url().should('include', '/dashboard')
    }
  })
}

/**
 * Login as CRM Laura (Marketing)
 * Session is cached and reused across tests
 */
export function loginAsCrmLaura() {
  cy.session('crm-laura-session', () => {
    cy.visit('/login')
    const devKeyring = new DevKeyring()
    devKeyring.validateVisible()
    devKeyring.quickLoginByEmail(CRM_USERS.LAURA)
    cy.url().should('include', '/dashboard')
  }, {
    validate: () => {
      cy.visit('/dashboard')
      cy.url().should('include', '/dashboard')
    }
  })
}
