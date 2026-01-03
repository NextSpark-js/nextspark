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
 */

import { SettingsPOM } from '../../src/features/SettingsPOM'
import { loginAsDefaultOwner } from '../../src/session-helpers'

describe('Settings Teams Selectors Validation', { tags: ['@ui-selectors'] }, () => {
  const settings = SettingsPOM.create()

  beforeEach(() => {
    loginAsDefaultOwner()
    cy.visit('/dashboard/settings/teams', { timeout: 60000 })
    // Wait for teams page to load - either main or loading should appear
    cy.get('[data-cy="teams-settings-main"], [data-cy="teams-settings-loading"]', { timeout: 15000 }).should('exist')
  })

  // ============================================
  // TEAMS SETTINGS SELECTORS (6 selectors in CORE_SELECTORS)
  // ============================================
  describe('Teams Page Selectors', () => {
    it('should find teams main container', () => {
      // Wait for loading to finish
      cy.get('[data-cy="teams-settings-main"]', { timeout: 15000 }).should('exist')
    })

    it('should find teams header', () => {
      cy.get('[data-cy="teams-settings-header"]', { timeout: 15000 }).should('exist')
    })

    // Note: Loading skeleton appears briefly during initial load
    it.skip('should find loading skeleton (only visible during loading)', () => {
      cy.get('[data-cy="teams-settings-loading"]').should('exist')
    })

    // Note: Single user message only appears for users not in any team
    it.skip('should find single user message (only for users without teams)', () => {
      cy.get('[data-cy="teams-settings-single-user"]').should('exist')
    })

    it('should find teams list', () => {
      cy.get('[data-cy="teams-settings-teams-list"]', { timeout: 15000 }).should('exist')
    })

    // Note: Team details only appears when a team is selected
    it.skip('should find team details section (only when team is selected)', () => {
      cy.get('[data-cy="teams-settings-team-details"]', { timeout: 15000 }).should('exist')
    })

    // Additional selectors implemented but not in CORE_SELECTORS.settings.teams
    it('should find create team button', () => {
      cy.get('[data-cy="create-team-button"]', { timeout: 15000 }).should('exist')
    })
  })
})
