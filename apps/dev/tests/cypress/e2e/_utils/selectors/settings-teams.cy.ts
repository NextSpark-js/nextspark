/**
 * UI Selectors Validation: Settings Teams
 *
 * This test validates that settings teams selectors exist in the DOM.
 * This is a lightweight test that ONLY checks selector presence, not functionality.
 *
 * Purpose:
 * - Validate SettingsPOM teams selectors work correctly
 * - Ensure all settings.teams.* selectors are implemented
 * - Run as Phase 12 sub-gate before functional tests
 *
 * Scope:
 * - Navigate to teams settings page (requires login)
 * - Assert elements exist in DOM (no form submissions)
 * - Fast execution (< 30 seconds per describe block)
 *
 * Test IDs:
 * - SEL_STMS_001: Teams Page Selectors
 * - SEL_STMS_002: Create Team Dialog (documentation only)
 */

import { SettingsPOM } from '../../../src/features/SettingsPOM'
import { loginAsDefaultDeveloper } from '../../../src/session-helpers'

describe('Settings Teams Selectors Validation', { tags: ['@ui-selectors', '@settings'] }, () => {
  const settings = SettingsPOM.create()

  beforeEach(() => {
    loginAsDefaultDeveloper()
    cy.visit('/dashboard/settings/teams', { timeout: 60000 })
    // Wait for teams page to load - either main or loading should appear
    cy.get('[data-cy="teams-settings-main"], [data-cy="teams-settings-loading"]', { timeout: 15000 }).should('exist')
  })

  // ============================================
  // SEL_STMS_001: TEAMS PAGE SELECTORS
  // ============================================
  describe('SEL_STMS_001: Teams Page Selectors', { tags: '@SEL_STMS_001' }, () => {
    it('should find teams main container', () => {
      // Wait for loading to finish
      cy.get('[data-cy="teams-settings-main"]', { timeout: 15000 }).should('exist')
    })

    it('should find teams header', () => {
      cy.get('[data-cy="teams-settings-header"]', { timeout: 15000 }).should('exist')
    })

    it('should find teams list', () => {
      cy.get('[data-cy="teams-settings-teams-list"]', { timeout: 15000 }).should('exist')
    })

    it('should find team item in list', () => {
      cy.get('[data-cy^="team-item-"]', { timeout: 15000 }).should('have.length.at.least', 1)
    })

    it('should find team details section when team is selected', () => {
      // Click on first team to select it
      cy.get('[data-cy^="team-item-"]').first().click()
      // Team details should appear
      cy.get('[data-cy="teams-settings-team-details"]', { timeout: 15000 }).should('exist')
    })

    // Additional selectors implemented but not in CORE_SELECTORS.settings.teams
    it('should find create team button', () => {
      cy.get('[data-cy="create-team-button"]', { timeout: 15000 }).should('exist')
    })
  })

  // ============================================
  // SEL_STMS_002: CREATE TEAM DIALOG
  // Tested in teams.cy.ts, documented here for reference
  // ============================================
  describe('SEL_STMS_002: Create Team Dialog Documentation', { tags: '@SEL_STMS_002' }, () => {
    it('should document create team dialog selectors', () => {
      cy.log('Create Team Dialog selectors are tested in teams.cy.ts')
      cy.log('Dialog selectors:')
      cy.log('- create-team-dialog')
      cy.log('- team-name-input')
      cy.log('- team-slug-input')
      cy.log('- team-description-input')
      cy.log('- cancel-create-team')
      cy.log('- submit-create-team')
      cy.wrap(true).should('be.true')
    })
  })
})
