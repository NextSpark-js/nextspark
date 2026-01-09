/**
 * UI Selectors Validation: Dashboard Navigation
 *
 * This test validates that dashboard navigation selectors exist in the DOM.
 * This is a lightweight test that ONLY checks selector presence, not functionality.
 *
 * Purpose:
 * - Validate dashboard shell and navigation selectors work correctly
 * - Ensure core navigation components have data-cy attributes
 * - Catch missing data-cy attributes early
 *
 * Scope:
 * - Navigate to dashboard (requires login)
 * - Assert elements exist in DOM (no form submissions)
 * - Fast execution (< 30 seconds)
 */

import { cySelector } from '../../src/selectors'

describe('Dashboard Navigation Selectors Validation', { tags: ['@ui-selectors'] }, () => {
  beforeEach(() => {
    cy.loginAsOwner()
    cy.visit('/dashboard', { timeout: 60000, failOnStatusCode: false })
    cy.url().should('include', '/dashboard')
  })

  // ============================================
  // DASHBOARD SHELL SELECTORS
  // ============================================
  describe('Dashboard Shell', () => {
    it('should find dashboard container', () => {
      cy.get(cySelector('dashboard.shell.container')).should('exist')
    })
  })

  // ============================================
  // TOPNAV SELECTORS
  // ============================================
  describe('Topnav Selectors', () => {
    it('should find topnav header', () => {
      cy.get(cySelector('dashboard.topnav.header')).should('exist')
    })

    it('should find sidebar toggle', () => {
      cy.get(cySelector('dashboard.topnav.sidebarToggle')).should('exist')
    })

    it('should find logo', () => {
      cy.get(cySelector('dashboard.topnav.logo')).should('exist')
    })

    it('should find actions container', () => {
      cy.get(cySelector('dashboard.topnav.actions')).should('exist')
    })

    it('should find theme toggle', () => {
      cy.get(cySelector('dashboard.topnav.themeToggle')).should('exist')
    })

    it('should find user menu trigger', () => {
      cy.get(cySelector('dashboard.topnav.userMenuTrigger')).should('exist')
    })

    it('should find user menu when clicked', () => {
      cy.get(cySelector('dashboard.topnav.userMenuTrigger')).click()
      cy.get(cySelector('dashboard.topnav.userMenu')).should('be.visible')
    })
  })

  // ============================================
  // SIDEBAR SELECTORS
  // ============================================
  describe('Sidebar Selectors', () => {
    it('should find sidebar main', () => {
      cy.get(cySelector('dashboard.sidebar.main')).should('exist')
    })

    // TODO: Sidebar component needs data-cy="sidebar-content" attribute
    it.skip('should find sidebar content', () => {
      cy.get(cySelector('dashboard.sidebar.content')).should('exist')
    })

    // TODO: Sidebar component needs data-cy="sidebar-footer" attribute
    it.skip('should find sidebar footer', () => {
      cy.get(cySelector('dashboard.sidebar.footer')).should('exist')
    })
  })

  // ============================================
  // NAVIGATION ENTITY LINKS
  // ============================================
  describe('Navigation Entity Links', () => {
    it('should find tasks entity link', () => {
      cy.get(cySelector('dashboard.navigation.entityLink', { slug: 'tasks' })).should('exist')
    })
  })

  // ============================================
  // GLOBAL SEARCH (if enabled)
  // ============================================
  describe('Global Search Selectors', () => {
    it('should find search section in topnav', () => {
      cy.get(cySelector('dashboard.topnav.searchSection')).should('exist')
    })
  })
})
