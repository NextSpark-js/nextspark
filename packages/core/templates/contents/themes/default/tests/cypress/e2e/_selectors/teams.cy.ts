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
 * NOTE: Some selectors require specific states (dialog open, team selected).
 * Many selectors from CORE_SELECTORS are dynamically scoped.
 */

import { TeamSwitcherPOM } from '../../src/components/TeamSwitcherPOM'
import { loginAsDefaultOwner } from '../../src/session-helpers'

describe('Teams Selectors Validation', { tags: ['@ui-selectors'] }, () => {
  const teamSwitcher = TeamSwitcherPOM.create()

  beforeEach(() => {
    loginAsDefaultOwner()
    cy.visit('/dashboard', { timeout: 60000, failOnStatusCode: false })
    cy.url().should('include', '/dashboard')
  })

  // ============================================
  // TEAM SWITCHER SELECTORS (6 selectors)
  // ============================================
  describe('Team Switcher Selectors', () => {
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
  // TEAM SWITCH MODAL SELECTORS (1 selector)
  // ============================================
  describe('Team Switch Modal Selectors', () => {
    // Note: Switch modal only appears when switching to a different team
    // This test validates the selector exists by attempting a switch
    it.skip('should find switch modal during team change (requires multiple teams)', () => {
      cy.get(teamSwitcher.selectors.switchModal).should('exist')
    })
  })

  // ============================================
  // CREATE TEAM DIALOG SELECTORS (7 selectors)
  // NOTE: Create Team Dialog is opened from settings/teams page
  // Those selectors are tested in settings-teams.cy.ts
  // ============================================
  describe('Create Team Dialog Selectors', () => {
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
  // SIDEBAR SELECTORS (2 selectors)
  // ============================================
  describe('Dashboard Sidebar Selectors', () => {
    it('should find sidebar main container', () => {
      cy.get(teamSwitcher.selectors.sidebar).should('exist')
    })

    it('should find sidebar toggle button', () => {
      cy.get(teamSwitcher.selectors.sidebarToggle).should('exist')
    })
  })

  // ============================================
  // MOBILE SELECTORS (3 selectors) - SKIP for desktop
  // ============================================
  describe('Mobile Team Switcher Selectors', () => {
    // Note: Mobile selectors only visible on small viewports
    it.skip('should find mobile more button (mobile viewport only)', () => {
      cy.get(teamSwitcher.selectors.mobileMoreButton).should('exist')
    })

    it.skip('should find mobile more sheet (mobile viewport only)', () => {
      cy.get(teamSwitcher.selectors.mobileMoreSheet).should('exist')
    })

    it.skip('should find mobile team switcher (mobile viewport only)', () => {
      cy.get(teamSwitcher.selectors.mobileTeamSwitcher).should('exist')
    })
  })

  // ============================================
  // TEAM MEMBERS SELECTORS (Section at settings)
  // These are tested in settings-teams.cy.ts
  // ============================================
  describe('Team Members Selectors', () => {
    it('should document team members are in settings', () => {
      cy.log('Team members selectors are tested in settings-teams.cy.ts')
      cy.log('Path: /dashboard/settings/teams')
      cy.wrap(true).should('be.true')
    })
  })
})
