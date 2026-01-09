/**
 * UI Selectors Validation: Settings Profile
 *
 * This test validates that settings profile selectors exist in the DOM.
 * This is a lightweight test that ONLY checks selector presence, not functionality.
 *
 * Purpose:
 * - Validate SettingsPOM profile selectors work correctly
 * - Ensure all settings.profile.* selectors are implemented
 * - Run as Phase 12 sub-gate before functional tests
 *
 * Scope:
 * - Navigate to profile settings page (requires login)
 * - Assert elements exist in DOM (no form submissions)
 * - Fast execution (< 30 seconds per describe block)
 *
 * Test IDs:
 * - SEL_PROF_001: Profile Page Selectors
 *
 * NOTE: Only 2 selectors are NOT implemented (feature doesn't exist):
 * - profile-avatar, profile-avatar-upload (avatar feature not in current implementation)
 */

import { SettingsPOM } from '../../../src/features/SettingsPOM'
import { loginAsDefaultDeveloper } from '../../../src/session-helpers'

describe('Settings Profile Selectors Validation', { tags: ['@ui-selectors', '@settings'] }, () => {
  const settings = SettingsPOM.create()

  beforeEach(() => {
    loginAsDefaultDeveloper()
    settings.visitProfile()
    // Wait for profile page to load - use profile form as indicator
    cy.get(settings.selectors.profileForm, { timeout: 15000 }).should('be.visible')
  })

  // ============================================
  // SEL_PROF_001: PROFILE PAGE SELECTORS
  // ============================================
  describe('SEL_PROF_001: Profile Page Selectors', { tags: '@SEL_PROF_001' }, () => {
    it('should find profile container', () => {
      cy.get(settings.selectors.profileContainer).should('exist')
    })

    it('should find profile form', () => {
      cy.get(settings.selectors.profileForm).should('exist')
    })

    // NOTE: Avatar selectors not implemented in current ProfilePage component
    it.skip('should find profile avatar (not implemented in component)', () => {
      cy.get(settings.selectors.profileAvatar).should('exist')
    })

    it.skip('should find avatar upload button (not implemented in component)', () => {
      cy.get(settings.selectors.profileAvatarUpload).should('exist')
    })

    it('should find first name input', () => {
      cy.get(settings.selectors.profileFirstName).should('exist')
    })

    it('should find last name input', () => {
      cy.get(settings.selectors.profileLastName).should('exist')
    })

    it('should find email input', () => {
      cy.get(settings.selectors.profileEmail).should('exist')
    })

    it('should find submit button', () => {
      cy.get(settings.selectors.profileSubmit).should('exist')
    })

    // Note: Success message only appears after successful form submission
    it.skip('should find success message (requires successful submission)', () => {
      cy.get(settings.selectors.profileSuccess).should('exist')
    })
  })
})
