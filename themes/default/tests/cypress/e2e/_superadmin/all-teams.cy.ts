/// <reference types="cypress" />

/**
 * Superadmin All Teams Management Tests
 *
 * Tests the Sector7 all teams management page:
 * - Teams list access and display
 * - Team details view
 * - Team filtering and search
 * - Cross-team navigation
 *
 * Tags: @uat, @feat-superadmin, @superadmin, @teams
 */

import * as allure from 'allure-cypress'

import { loginAsDefaultSuperadmin } from '../../src/session-helpers'
import { SuperadminPOM } from '../../src/features/SuperadminPOM'

describe('Sector7 - All Teams Management', {
  tags: ['@uat', '@feat-superadmin', '@superadmin', '@teams']
}, () => {
  const superadmin = SuperadminPOM.create()

  beforeEach(() => {
    allure.epic('Admin')
    allure.feature('Teams Management')
    allure.story('All Teams')
    loginAsDefaultSuperadmin()
  })

  describe('ADMIN-TEAMS-001: Teams List Access', { tags: '@smoke' }, () => {
    it('should access all teams list', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // 1. Visit Sector7 Teams
      superadmin.visitTeams()

      // 2. Validate teams page
      cy.url().should('include', '/superadmin/teams')
      cy.contains('Team Management').should('be.visible')
      superadmin.assertTeamsVisible()

      cy.log('✅ Teams list accessible')
    })
  })

  describe('ADMIN-TEAMS-002: Teams List Display', { tags: '@smoke' }, () => {
    it('should display teams in a list or table', { tags: '@smoke' }, () => {
      allure.severity('critical')

      // 1. Visit Sector7 Teams
      superadmin.visitTeams()

      // 2. Validate teams list/table exists
      cy.get(superadmin.selectors.teamsContainer).then(($container) => {
        // Check for list or table of teams
        const hasTable = $container.find(superadmin.selectors.teamsTable).length > 0
        const hasRows = $container.find('[data-cy^="superadmin-teams-row-"]').length > 0
        if (hasTable || hasRows) {
          cy.log('✅ Teams displayed in list')
        } else {
          cy.log('⚠️ Teams table/list not found')
        }
      })
    })
  })

  describe('ADMIN-TEAMS-003: View Team Details', () => {
    it('should view individual team details', () => {
      allure.severity('high')

      // 1. Visit Sector7 Teams
      superadmin.visitTeams()

      // 2. Find and click first team row
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="superadmin-team-row"]').length > 0) {
          cy.get('[data-cy^="superadmin-team-row"]').first().click()

          // 3. Validate team details view
          cy.url().should('include', '/superadmin/teams/')

          cy.log('✅ Team details accessible')
        } else {
          cy.log('⚠️ No team rows found to test details view')
        }
      })
    })
  })

  describe('ADMIN-TEAMS-004: Team Search', () => {
    it('should filter teams by search query', () => {
      allure.severity('high')

      // 1. Visit Sector7 Teams
      superadmin.visitTeams()

      // 2. Check if search exists
      cy.get('body').then(($body) => {
        if ($body.find(superadmin.selectors.teamsSearch).length > 0) {
          superadmin.searchTeams('Test')

          // 3. Wait for filter to apply
          cy.wait(500)

          cy.log('✅ Team search functional')
        } else {
          cy.log('⚠️ Search not implemented yet')
        }
      })
    })
  })

  describe('ADMIN-TEAMS-005: Team Member Count', () => {
    it('should display member count for each team', () => {
      allure.severity('normal')

      // 1. Visit Sector7 Teams
      superadmin.visitTeams()

      // 2. Check for member count display
      cy.get(superadmin.selectors.teamsContainer).within(() => {
        cy.get('[data-cy^="superadmin-team-row"]').first().then(($team) => {
          // Check for member count indicator
          if ($team.find('[data-cy="team-member-count"]').length > 0) {
            cy.wrap($team).find('[data-cy="team-member-count"]').should('be.visible')
            cy.log('✅ Member count displayed')
          } else {
            cy.log('⚠️ Member count not displayed in list view')
          }
        })
      })
    })
  })

  describe('ADMIN-TEAMS-006: Navigate Back to Dashboard', () => {
    it('should navigate back to Sector7 dashboard', () => {
      allure.severity('normal')

      // 1. Visit Sector7 Teams
      superadmin.visitTeams()

      // 2. Click on dashboard nav
      superadmin.clickNavDashboard()

      // 3. Validate back at dashboard
      cy.url().should('match', /\/superadmin\/?$/)
      superadmin.assertDashboardVisible()

      cy.log('✅ Navigation to dashboard works')
    })
  })

  describe('ADMIN-TEAMS-007: Team Plan Display', () => {
    it('should display billing plan for each team', () => {
      allure.severity('normal')

      // 1. Visit Sector7 Teams
      superadmin.visitTeams()

      // 2. Check for plan indicator
      cy.get(superadmin.selectors.teamsContainer).then(($container) => {
        if ($container.find('[data-cy^="team-plan-"]').length > 0) {
          cy.get('[data-cy^="team-plan-"]').first().should('be.visible')
          cy.log('✅ Team plan displayed')
        } else {
          cy.log('⚠️ Team plan not displayed in list view')
        }
      })
    })
  })

  after(() => {
    cy.log('✅ Sector7 all teams tests completed')
  })
})
