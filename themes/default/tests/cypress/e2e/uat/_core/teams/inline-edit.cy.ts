/// <reference types="cypress" />

/**
 * Inline Team Editing - E2E Tests
 *
 * Tests for inline editing of team name and description.
 * Validates owner-only access and proper UI behavior.
 *
 * @see PR#1 for feature context
 * @session 2026-01-11-pr1-translations-pom-fixes-v1
 */

import * as allure from 'allure-cypress'

import { DevKeyringPOM } from '../../../../src/components/DevKeyringPOM'
import { SettingsPOM } from '../../../../src/features/SettingsPOM'

// Test users
const USERS = {
  OWNER: 'superadmin@cypress.com',    // Team owner (superadmin)
  MEMBER: 'developer@cypress.com',    // Team member (developer - not owner of default team)
}

describe('Inline Team Editing', {
  tags: ['@uat', '@feat-teams', '@team-settings', '@regression']
}, () => {
  const settings = SettingsPOM.create()

  beforeEach(() => {
    allure.epic('UAT')
    allure.feature('Teams')
    allure.story('Inline Team Editing')
  })

  // ============================================
  // Owner Can Edit
  // ============================================

  describe('Owner Can Edit', () => {
    beforeEach(() => {
      cy.session('carlos-owner-inline-edit', () => {
        cy.visit('/login')
        const devKeyring = DevKeyringPOM.create()
        devKeyring.validateVisible()
        devKeyring.quickLoginByEmail(USERS.OWNER)
        cy.url().should('include', '/dashboard')
      })
      cy.visit('/dashboard/settings/team', { timeout: 60000, failOnStatusCode: false })
      settings.waitForTeam()
    })

    it('TEAM_EDIT_001: Owner can see edit buttons for name and description', { tags: '@smoke' }, () => {
      allure.severity('critical')
      allure.description('Verify that team owners can see edit icons for both team name and description fields')

      settings.assertTeamNameEditable()
      settings.assertTeamDescriptionEditable()
    })

    it('TEAM_EDIT_002: Owner can edit and save team name', () => {
      allure.severity('critical')
      allure.description('Verify that team owners can successfully edit and save the team name')

      const newName = `Test Team ${Date.now()}`

      settings.editAndSaveTeamName(newName)

      // Wait for success feedback
      cy.wait(500)

      // Verify the new name is displayed
      settings.getTeamNameText().should('contain', newName)
    })

    it('TEAM_EDIT_003: Owner can edit and save team description', () => {
      allure.severity('critical')
      allure.description('Verify that team owners can successfully edit and save the team description')

      const newDesc = `Updated description ${Date.now()}`

      settings.editAndSaveTeamDescription(newDesc)

      // Wait for success feedback
      cy.wait(500)

      // Verify the new description is displayed
      settings.getTeamDescriptionText().should('contain', newDesc)
    })

    it('TEAM_EDIT_004: Cancel editing team name preserves original value', () => {
      allure.severity('normal')
      allure.description('Verify that canceling team name editing does not save changes')

      // Get original name
      settings.getTeamNameText().then((originalName) => {
        // Start editing
        settings.editTeamName()
        settings.typeTeamName('Changed Name That Should Not Save')
        settings.cancelTeamName()

        // Verify original name is preserved
        settings.getTeamNameText().should('equal', originalName)
      })
    })

    it('TEAM_EDIT_005: Cancel editing team description preserves original value', () => {
      allure.severity('normal')
      allure.description('Verify that canceling team description editing does not save changes')

      // Get original description
      settings.getTeamDescriptionText().then((originalDesc) => {
        // Start editing
        settings.editTeamDescription()
        settings.typeTeamDescription('Changed description that should not save')
        settings.cancelTeamDescription()

        // Verify original description is preserved
        settings.getTeamDescriptionText().should('equal', originalDesc)
      })
    })
  })

  // ============================================
  // Member Cannot Edit
  // ============================================

  describe('Member Cannot Edit', () => {
    beforeEach(() => {
      cy.session('emily-member-inline-edit', () => {
        cy.visit('/login')
        const devKeyring = DevKeyringPOM.create()
        devKeyring.validateVisible()
        devKeyring.quickLoginByEmail(USERS.MEMBER)
        cy.url().should('include', '/dashboard')
      })
      cy.visit('/dashboard/settings/team', { timeout: 60000, failOnStatusCode: false })
      settings.waitForTeam()
    })

    it('TEAM_EDIT_010: Member cannot see edit button for team name', { tags: '@smoke' }, () => {
      allure.severity('critical')
      allure.description('Verify that non-owner team members cannot see edit icons for team name')

      settings.assertTeamNameNotEditable()
    })

    it('TEAM_EDIT_011: Member cannot see edit button for team description', { tags: '@smoke' }, () => {
      allure.severity('critical')
      allure.description('Verify that non-owner team members cannot see edit icons for team description')

      settings.assertTeamDescriptionNotEditable()
    })
  })

  // ============================================
  // Validation Tests
  // ============================================

  describe('Validation', () => {
    beforeEach(() => {
      cy.session('carlos-validation-inline-edit', () => {
        cy.visit('/login')
        const devKeyring = DevKeyringPOM.create()
        devKeyring.validateVisible()
        devKeyring.quickLoginByEmail(USERS.OWNER)
        cy.url().should('include', '/dashboard')
      })
      cy.visit('/dashboard/settings/team', { timeout: 60000, failOnStatusCode: false })
      settings.waitForTeam()
    })

    it('TEAM_EDIT_020: Name validation - minimum length (2 characters)', () => {
      allure.severity('normal')
      allure.description('Verify that team name must have at least 2 characters')

      // Click edit, enter single character, try to save
      settings.editTeamName()
      settings.typeTeamName('A')
      settings.saveTeamName()

      // Should show validation error (in any locale)
      cy.contains(/at least 2|mindestens 2|almeno 2|pelo menos 2|au moins 2|mínimo 2/i, { timeout: 5000 })
        .should('be.visible')
    })

    it('TEAM_EDIT_021: Empty team name shows validation error', () => {
      allure.severity('normal')
      allure.description('Verify that team name cannot be empty')

      // Click edit, clear input, try to save
      settings.editTeamName()
      cy.get(settings.selectors.teamEditNameInput).clear()
      settings.saveTeamName()

      // Should show validation error (in any locale)
      cy.contains(/required|erforderlich|obbligatorio|obrigatório|requis/i, { timeout: 5000 })
        .should('be.visible')
    })

    it('TEAM_EDIT_022: Empty team description is allowed', () => {
      allure.severity('normal')
      allure.description('Verify that team description can be empty (optional field)')

      // Click edit, clear textarea, save
      settings.editTeamDescription()
      cy.get(settings.selectors.teamEditDescriptionTextarea).clear()
      settings.saveTeamDescription()

      // Wait for save to complete
      cy.wait(500)

      // No error should appear - description is optional
      cy.get(settings.selectors.teamEditDescriptionError).should('not.exist')
    })

    it('TEAM_EDIT_023: Name validation - maximum length (100 characters)', () => {
      allure.severity('normal')
      allure.description('Verify that team name cannot exceed 100 characters')

      const longName = 'A'.repeat(101) // 101 characters

      settings.editTeamName()
      settings.typeTeamName(longName)
      settings.saveTeamName()

      // Should show validation error (in any locale)
      cy.contains(/maximum|maximal|massimo|máximo/i, { timeout: 5000 })
        .should('be.visible')
    })
  })

  // ============================================
  // Multi-Locale Tests
  // ============================================

  describe('Multi-Locale Support', () => {
    const locales = [
      { code: 'de', name: 'German' },
      { code: 'fr', name: 'French' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
    ]

    locales.forEach(({ code, name }) => {
      it(`TEAM_EDIT_030_${code.toUpperCase()}: Inline editing works in ${name} locale`, () => {
        allure.severity('normal')
        allure.description(`Verify that inline team editing displays correctly in ${name} locale`)

        // Login as owner
        cy.session(`carlos-locale-${code}`, () => {
          cy.visit('/login')
          const devKeyring = DevKeyringPOM.create()
          devKeyring.validateVisible()
          devKeyring.quickLoginByEmail(USERS.OWNER)
          cy.url().should('include', '/dashboard')
        })

        // Visit with locale query param
        cy.visit(`/dashboard/settings/team?locale=${code}`, { timeout: 60000, failOnStatusCode: false })
        settings.waitForTeam()

        // Verify edit icons are visible (selectors are locale-independent)
        settings.assertTeamNameEditable()
        settings.assertTeamDescriptionEditable()

        // Test editing flow
        const testName = `Test ${name} ${Date.now()}`
        settings.editAndSaveTeamName(testName)

        // Wait for save
        cy.wait(500)

        // Verify new name appears
        settings.getTeamNameText().should('contain', testName)
      })
    })
  })
})
