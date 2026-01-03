/**
 * Session Helpers - cy.session() utilities for role-based testing
 *
 * Uses DevKeyring for quick login and maintains sessions across tests
 * for optimal performance.
 */

import { DevKeyring } from '../classes/components/auth/DevKeyring.js'

/**
 * Test users organized by theme
 * Each theme has its own set of users with different roles
 */
export const TEST_USERS = {
  /**
   * Default theme - Multi-tenant SaaS with multiple organizations
   * Teams: Everpoint Labs, Ironvale Global, Riverstone Ventures
   */
  default: {
    OWNER: 'carlos.mendoza@nextspark.dev',      // Everpoint Labs (owner), Riverstone (member)
    ADMIN: 'james.wilson@nextspark.dev',        // Everpoint Labs (admin)
    MEMBER: 'emily.johnson@nextspark.dev',      // Everpoint (member), Riverstone (admin)
    VIEWER: 'sarah.davis@nextspark.dev',        // Ironvale Global (viewer)
    // Additional users
    ANA: 'ana.garcia@nextspark.dev',            // Ironvale Global (owner)
    SOFIA: 'sofia.lopez@nextspark.dev',         // Riverstone (owner), Ironvale (admin)
  },

  /**
   * CRM theme - Single-tenant with department roles
   * Organization: Ventas Pro S.A.
   */
  crm: {
    OWNER: 'crm_owner_roberto@nextspark.dev',   // CEO
    ADMIN: 'crm_admin_sofia@nextspark.dev',     // Sales Manager
    MEMBER: 'crm_member_miguel@nextspark.dev',  // Sales Rep
    // Additional users
    LAURA: 'crm_member_laura@nextspark.dev',    // Marketing
  },

  /**
   * Productivity theme - Multi-tenant project management
   * Teams: Product Team, Marketing Hub
   */
  productivity: {
    OWNER: 'prod_owner_patricia@nextspark.dev',       // Product Team (owner), Marketing Hub (owner)
    ADMIN: 'prod_admin_member_lucas@nextspark.dev',   // Product Team (admin), Marketing Hub (member)
    MEMBER: 'prod_member_diana@nextspark.dev',        // Product Team (member)
    // Additional users
    MARCOS: 'prod_member_marcos@nextspark.dev',       // Marketing Hub (member)
  },

  /**
   * Blog theme - Individual author blogs
   * Each user owns their own blog
   */
  blog: {
    OWNER: 'blog_author_marcos@nextspark.dev',  // Marcos Tech Blog (owner)
    // Additional authors
    LUCIA: 'blog_author_lucia@nextspark.dev',   // Lucia Lifestyle Blog (owner)
    CARLOS: 'blog_author_carlos@nextspark.dev', // Carlos Finance Blog (owner)
  },
} as const

/**
 * Type for theme names
 */
export type ThemeName = keyof typeof TEST_USERS

/**
 * Get the current active theme from environment or default
 */
export function getActiveTheme(): ThemeName {
  const theme = Cypress.env('ACTIVE_THEME') || 'default'
  return theme as ThemeName
}

/**
 * Get test users for the current active theme
 */
export function getThemeUsers() {
  const theme = getActiveTheme()
  return TEST_USERS[theme]
}

// =============================================================================
// LOGIN HELPERS - Use current theme's users
// =============================================================================

/**
 * Login as Owner for the current theme
 * Session is cached and reused across tests
 */
export function loginAsOwner() {
  const users = getThemeUsers()
  cy.session('owner-session', () => {
    cy.visit('/login')
    const devKeyring = new DevKeyring()
    devKeyring.validateVisible()
    devKeyring.quickLoginByEmail(users.OWNER)
    cy.url().should('include', '/dashboard')
  }, {
    validate: () => {
      cy.visit('/dashboard')
      cy.url().should('include', '/dashboard')
    }
  })
}

/**
 * Login as Admin for the current theme
 * Session is cached and reused across tests
 */
export function loginAsAdmin() {
  const users = getThemeUsers()
  if (!('ADMIN' in users)) {
    throw new Error(`Theme "${getActiveTheme()}" does not have an ADMIN user`)
  }
  cy.session('admin-session', () => {
    cy.visit('/login')
    const devKeyring = new DevKeyring()
    devKeyring.validateVisible()
    devKeyring.quickLoginByEmail((users as any).ADMIN)
    cy.url().should('include', '/dashboard')
  }, {
    validate: () => {
      cy.visit('/dashboard')
      cy.url().should('include', '/dashboard')
    }
  })
}

/**
 * Login as Member for the current theme
 * Session is cached and reused across tests
 */
export function loginAsMember() {
  const users = getThemeUsers()
  if (!('MEMBER' in users)) {
    throw new Error(`Theme "${getActiveTheme()}" does not have a MEMBER user`)
  }
  cy.session('member-session', () => {
    cy.visit('/login')
    const devKeyring = new DevKeyring()
    devKeyring.validateVisible()
    devKeyring.quickLoginByEmail((users as any).MEMBER)
    cy.url().should('include', '/dashboard')
  }, {
    validate: () => {
      cy.visit('/dashboard')
      cy.url().should('include', '/dashboard')
    }
  })
}

/**
 * Login as Viewer for the current theme (only available in some themes)
 * Session is cached and reused across tests
 */
export function loginAsViewer() {
  const users = getThemeUsers()
  if (!('VIEWER' in users)) {
    throw new Error(`Theme "${getActiveTheme()}" does not have a VIEWER user`)
  }
  cy.session('viewer-session', () => {
    cy.visit('/login')
    const devKeyring = new DevKeyring()
    devKeyring.validateVisible()
    devKeyring.quickLoginByEmail((users as any).VIEWER)
    cy.url().should('include', '/dashboard')
  }, {
    validate: () => {
      cy.visit('/dashboard')
      cy.url().should('include', '/dashboard')
    }
  })
}

/**
 * Login with a specific email (for custom test scenarios)
 * @param email - User email to login with
 * @param sessionName - Unique session name for caching
 */
export function loginWithEmail(email: string, sessionName: string = `session-${email}`) {
  cy.session(sessionName, () => {
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
