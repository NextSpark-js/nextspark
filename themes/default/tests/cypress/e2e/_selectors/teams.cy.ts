/**
 * UI Selectors Validation: Teams
 *
 * This test validates that teams selectors exist in the DOM.
 * This is a lightweight test that ONLY checks selector presence, not functionality.
 *
 * Purpose:
 * - Validate TeamSwitcherPOM selectors work correctly
 * - Ensure all teams.* selectors are implemented
 * - Run as Phase 12 sub-gate before functional tests
 *
 * Scope:
 * - Navigate to dashboard (requires login)
 * - Assert elements exist in DOM (no form submissions)
 * - Fast execution (< 30 seconds per describe block)
 *
 * Test IDs:
 * - SEL_TEAM_001: Team Switcher Selectors
 * - SEL_TEAM_003: Create Team Dialog Documentation
 * - SEL_TEAM_004: Dashboard Sidebar Selectors
 * - SEL_TEAM_006: Team Members Documentation
 * - SEL_TEAM_007: Multi-Team Switch Modal (Carlos Mendoza - multiple teams)
 * - SEL_TEAM_008: Mobile Team Switcher (iphone-x viewport)
 *
 * NOTE: Some selectors require specific states (dialog open, team selected).
 * Many selectors from CORE_SELECTORS are dynamically scoped.
 */

import { TeamSwitcherPOM } from '../../src/components/TeamSwitcherPOM'
import { loginAsDefaultDeveloper, loginAsDefaultOwner } from '../../src/session-helpers'

describe('Teams Selectors Validation', { tags: ['@ui-selectors', '@teams'] }, () => {
  const teamSwitcher = TeamSwitcherPOM.create()

  beforeEach(() => {
    loginAsDefaultDeveloper()
    cy.visit('/dashboard', { timeout: 60000, failOnStatusCode: false })
    cy.url().should('include', '/dashboard')
  })

  // ============================================
  // SEL_TEAM_001: TEAM SWITCHER SELECTORS
  // ============================================
  describe('SEL_TEAM_001: Team Switcher Selectors', { tags: '@SEL_TEAM_001' }, () => {
    beforeEach(() => {
      teamSwitcher.ensureSidebarExpanded()
    })

    it('should find team switcher compact trigger', () => {
      cy.get(teamSwitcher.selectors.trigger).should('exist')
    })

    it('should find team switcher dropdown when opened', () => {
      teamSwitcher.open()
      cy.get(teamSwitcher.selectors.dropdown).should('be.visible')
    })

    it('should find team option in dropdown', () => {
      teamSwitcher.open()
      cy.get(teamSwitcher.selectors.teamOption).should('have.length.at.least', 1)
    })

    it('should find manage teams link', () => {
      teamSwitcher.open()
      cy.get(teamSwitcher.selectors.manageTeamsLink).should('exist')
    })

    // NOTE: Create team button is NOT in TeamSwitcherCompact
    // It is in the full TeamSwitcher (used in settings/teams page)
    // That button is tested in settings-teams.cy.ts
    it('should document that create button is in settings', () => {
      cy.log('Create Team button is in TeamSwitcher (full version)')
      cy.log('Tested at: /dashboard/settings/teams via settings-teams.cy.ts')
      cy.wrap(true).should('be.true')
    })
  })

  // ============================================
  // SEL_TEAM_003: CREATE TEAM DIALOG DOCUMENTATION
  // NOTE: Create Team Dialog is opened from settings/teams page
  // Those selectors are tested in settings-teams.cy.ts
  // ============================================
  describe('SEL_TEAM_003: Create Team Dialog Documentation', { tags: '@SEL_TEAM_003' }, () => {
    it('should document that Create Team Dialog is in settings', () => {
      cy.log('Create Team Dialog selectors:')
      cy.log('- create-team-dialog')
      cy.log('- team-name-input')
      cy.log('- team-slug-input')
      cy.log('- team-description-input')
      cy.log('- cancel-create-team')
      cy.log('- submit-create-team')
      cy.log('Tested at: /dashboard/settings/teams')
      cy.wrap(true).should('be.true')
    })
  })

  // ============================================
  // SEL_TEAM_004: DASHBOARD SIDEBAR SELECTORS
  // ============================================
  describe('SEL_TEAM_004: Dashboard Sidebar Selectors', { tags: '@SEL_TEAM_004' }, () => {
    it('should find sidebar main container', () => {
      cy.get(teamSwitcher.selectors.sidebar).should('exist')
    })

    it('should find sidebar toggle button', () => {
      cy.get(teamSwitcher.selectors.sidebarToggle).should('exist')
    })
  })

  // ============================================
  // SEL_TEAM_006: TEAM MEMBERS DOCUMENTATION
  // These are tested in settings-teams.cy.ts
  // ============================================
  describe('SEL_TEAM_006: Team Members Documentation', { tags: '@SEL_TEAM_006' }, () => {
    it('should document team members are in settings', () => {
      cy.log('Team members selectors are tested in settings-teams.cy.ts')
      cy.log('Path: /dashboard/settings/teams')
      cy.wrap(true).should('be.true')
    })
  })
})

// ============================================
// MULTI-TEAM USER TESTS (Carlos Mendoza - Owner)
// Uses a separate session with multiple teams
// ============================================
describe('Teams Selectors - Multi-Team User', { tags: ['@ui-selectors', '@teams', '@multi-team'] }, () => {
  const teamSwitcher = TeamSwitcherPOM.create()

  beforeEach(() => {
    loginAsDefaultOwner()
    cy.visit('/dashboard', { timeout: 60000, failOnStatusCode: false })
    cy.url().should('include', '/dashboard')
  })

  // ============================================
  // SEL_TEAM_007: TEAM SWITCH MODAL (Multi-Team)
  // Carlos Mendoza has multiple teams to test switching
  // ============================================
  describe('SEL_TEAM_007: Team Switch Modal', { tags: '@SEL_TEAM_007' }, () => {
    beforeEach(() => {
      teamSwitcher.ensureSidebarExpanded()
    })

    it('should find multiple team options in dropdown', () => {
      teamSwitcher.open()
      cy.get(teamSwitcher.selectors.teamOption).should('have.length.at.least', 2)
    })

    it('should find switch modal when changing teams', () => {
      teamSwitcher.open()
      // Get the second team option (different from current)
      cy.get(teamSwitcher.selectors.teamOption).eq(1).click()
      // Switch modal should appear during team change
      cy.get(teamSwitcher.selectors.switchModal, { timeout: 10000 }).should('exist')
    })
  })
})

// ============================================
// MOBILE VIEWPORT TESTS
// Uses mobile viewport to test responsive selectors
// ============================================
describe('Teams Selectors - Mobile Viewport', { tags: ['@ui-selectors', '@teams', '@mobile'] }, () => {
  const teamSwitcher = TeamSwitcherPOM.create()

  beforeEach(() => {
    // Set mobile viewport BEFORE login/visit
    cy.viewport('iphone-x')
    loginAsDefaultDeveloper()
    cy.visit('/dashboard', { timeout: 60000, failOnStatusCode: false })
    cy.url().should('include', '/dashboard')
  })

  // ============================================
  // SEL_TEAM_008: MOBILE TEAM SWITCHER SELECTORS
  // Tests mobile-specific UI elements
  // ============================================
  describe('SEL_TEAM_008: Mobile Team Switcher', { tags: '@SEL_TEAM_008' }, () => {
    it('should find mobile more button', () => {
      cy.get(teamSwitcher.selectors.mobileMoreButton).should('exist')
    })

    it('should find mobile more sheet when opened', () => {
      cy.get(teamSwitcher.selectors.mobileMoreButton).click()
      cy.get(teamSwitcher.selectors.mobileMoreSheet).should('be.visible')
    })

    it('should find mobile team switcher in sheet', () => {
      cy.get(teamSwitcher.selectors.mobileMoreButton).click()
      cy.get(teamSwitcher.selectors.mobileMoreSheet).should('be.visible')
      cy.get(teamSwitcher.selectors.mobileTeamSwitcher).should('exist')
    })
  })
})
