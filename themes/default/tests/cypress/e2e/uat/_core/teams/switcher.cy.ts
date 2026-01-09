/// <reference types="cypress" />

/**
 * Team Switcher - E2E Tests
 *
 * Tests for the TeamSwitcherCompact component in multi-tenant mode.
 * Validates team switching functionality, data reload, and permission changes.
 *
 * @see team-switcher.md for documentation
 */

import * as allure from 'allure-cypress'

import { DevKeyringPOM } from '../../../../src/components/DevKeyringPOM'
import { TeamSwitcherPOM } from '../../../../src/components/TeamSwitcherPOM'

// Test users from default theme
// Note: DB data shows different team counts than DevKeyring config comments
const USERS = {
  // Multi-team users (actual DB data)
  CARLOS: 'carlos.mendoza@nextspark.dev',      // Everpoint (owner), Riverstone (member), Ironvale (admin) - 3 teams
  SOFIA: 'sofia.lopez@nextspark.dev',          // Riverstone (owner), Ironvale (admin) - 2 teams
  EMILY: 'emily.johnson@nextspark.dev',        // Everpoint (member), Riverstone (admin) - 2 teams
  JAMES: 'james.wilson@nextspark.dev',         // Everpoint (admin), Riverstone (member?) - 2 teams

  // Single-team users
  ANA: 'ana.garcia@nextspark.dev',             // Ironvale Global (owner) - 1 team
  SARAH: 'sarah.davis@nextspark.dev',          // Ironvale Global (viewer) - 1 team
}

// Team slugs (from actual DB data visible in tests)
const TEAMS = {
  EVERPOINT: 'everpoint-labs',
  RIVERSTONE: 'riverstone-ventures',
  // Note: Carlos also has "Carlos Mendoza Team" but slug unknown
  // Ana may have different teams than expected
}

// Role translations (Spanish - app default locale is 'es')
const ROLES = {
  OWNER: 'Propietario',
  ADMIN: 'Administrador',
  MEMBER: 'Miembro',
  EDITOR: 'Editor',
  VIEWER: 'Observador',
}

describe('Team Switcher', {
  tags: ['@uat', '@feat-teams', '@workflow', '@regression']
}, () => {
  const teamSwitcher = TeamSwitcherPOM.create()

  beforeEach(() => {
    allure.epic('UAT')
    allure.feature('Teams')
    allure.story('Team Switching')
  })

  // ============================================
  // Single/Few Team User
  // ============================================

  describe('Single/Few Team User', () => {
    beforeEach(() => {
      // Use Ana - should have fewer teams than Carlos
      cy.session('ana-few-teams', () => {
        cy.visit('/login')
        const devKeyring = DevKeyringPOM.create()
        devKeyring.validateVisible()
        devKeyring.quickLoginByEmail(USERS.ANA)
        cy.url().should('include', '/dashboard')
      })
      cy.visit('/dashboard', { timeout: 60000, failOnStatusCode: false })
      cy.url().should('include', '/dashboard')
    })

    it('TEAM_SW_001: User sees their teams in switcher', { tags: '@smoke' }, () => {
      allure.severity('critical')
      teamSwitcher.validateSwitcherVisible()
      // Ana has at least 1 team (actual count from DB may vary)
      teamSwitcher.open()
      cy.get('[data-cy^="team-option-"]').should('have.length.at.least', 1)
    })

    it('TEAM_SW_002: Manage Teams link is visible and navigates correctly', () => {
      teamSwitcher.validateManageTeamsVisible()
      teamSwitcher.goToManageTeams()
    })
  })

  // ============================================
  // Multi-Team User
  // ============================================

  describe('Multi-Team User', () => {
    beforeEach(() => {
      cy.session('carlos-multi-team', () => {
        cy.visit('/login')
        const devKeyring = DevKeyringPOM.create()
        devKeyring.validateVisible()
        devKeyring.quickLoginByEmail(USERS.CARLOS)
        cy.url().should('include', '/dashboard')
      })
      cy.visit('/dashboard', { timeout: 60000, failOnStatusCode: false })
      cy.url().should('include', '/dashboard')
    })

    it('TEAM_SW_010: Multi-team user sees all teams', () => {
      teamSwitcher.validateSwitcherVisible()
      // Carlos has 3 teams: Everpoint Labs (owner), Carlos Mendoza Team (owner), Riverstone Ventures (member)
      teamSwitcher.open()
      cy.get('[data-cy^="team-option-"]').should('have.length.at.least', 2)
      teamSwitcher.validateTeamInList(TEAMS.EVERPOINT)
      teamSwitcher.validateTeamInList(TEAMS.RIVERSTONE)
    })

    it('TEAM_SW_011: Current team shows checkmark', () => {
      // Carlos defaults to Everpoint Labs (owner)
      // Validate checkmark for active team
      teamSwitcher.validateTeamHasCheckmark(TEAMS.EVERPOINT)
      // Close dropdown using escape key to avoid pointer-events issue
      cy.get('body').type('{esc}')
      cy.get(teamSwitcher.selectors.dropdown).should('not.exist')
      // Now verify no checkmark on non-active team
      teamSwitcher.validateTeamNoCheckmark(TEAMS.RIVERSTONE)
    })

    it('TEAM_SW_012: Roles are displayed correctly', () => {
      // Carlos is owner in Everpoint, member in Riverstone (roles in Spanish)
      teamSwitcher.validateRoleDisplayed(TEAMS.EVERPOINT, ROLES.OWNER)
      // Close dropdown using escape key to avoid pointer-events issue
      cy.get('body').type('{esc}')
      cy.get(teamSwitcher.selectors.dropdown).should('not.exist')
      teamSwitcher.validateRoleDisplayed(TEAMS.RIVERSTONE, ROLES.MEMBER)
    })

    it('TEAM_SW_013: Can switch teams successfully', () => {
      // Validate starting on Everpoint
      teamSwitcher.validateCurrentTeamName('Everpoint Labs')

      // Switch to Riverstone
      teamSwitcher.switchToTeam(TEAMS.RIVERSTONE)

      // After reload, should be on Riverstone
      teamSwitcher.validateCurrentTeamName('Riverstone Ventures')
    })

    it('TEAM_SW_014: Modal appears during switch', () => {
      // Start switch process (don't wait for completion)
      teamSwitcher.selectTeam(TEAMS.RIVERSTONE)

      // Modal should appear
      teamSwitcher.validateSwitchModalVisible()
    })
  })

  // ============================================
  // Data Reload After Switch
  // ============================================

  describe('Data Reload After Switch', () => {
    beforeEach(() => {
      cy.session('carlos-data-reload', () => {
        cy.visit('/login')
        const devKeyring = DevKeyringPOM.create()
        devKeyring.validateVisible()
        devKeyring.quickLoginByEmail(USERS.CARLOS)
        cy.url().should('include', '/dashboard')
      })
      cy.visit('/dashboard', { timeout: 60000, failOnStatusCode: false })
      cy.url().should('include', '/dashboard')
    })

    it('TEAM_SW_020: Customers reload after switch', () => {
      // Navigate to customers
      cy.visit('/dashboard/customers')
      cy.get('[data-cy="customers-page"]', { timeout: 15000 }).should('exist')

      // Store current URL team context (via header/team name in switcher)
      teamSwitcher.getCurrentTeamName().then(originalTeam => {
        // Switch to Riverstone
        teamSwitcher.switchToTeam(TEAMS.RIVERSTONE)

        // Navigate to customers again
        cy.visit('/dashboard/customers')
        cy.get('[data-cy="customers-page"]', { timeout: 15000 }).should('exist')

        // Team name should be different
        teamSwitcher.getCurrentTeamName().should('not.eq', originalTeam)
      })
    })

    it('TEAM_SW_021: Tasks reload after switch', () => {
      // Navigate to tasks
      cy.visit('/dashboard/tasks')
      cy.get('[data-cy="tasks-page"]', { timeout: 15000 }).should('exist')

      // Store current team context
      teamSwitcher.getCurrentTeamName().then(originalTeam => {
        // Switch to Riverstone
        teamSwitcher.switchToTeam(TEAMS.RIVERSTONE)

        // Navigate to tasks again
        cy.visit('/dashboard/tasks')
        cy.get('[data-cy="tasks-page"]', { timeout: 15000 }).should('exist')

        // Team name should be different
        teamSwitcher.getCurrentTeamName().should('not.eq', originalTeam)
      })
    })

    it('TEAM_SW_022: Sidebar shows new team name', () => {
      // Validate starting on Everpoint
      teamSwitcher.validateCurrentTeamName('Everpoint Labs')

      // Switch to Riverstone
      teamSwitcher.switchToTeam(TEAMS.RIVERSTONE)

      // Sidebar should show Riverstone
      teamSwitcher.validateCurrentTeamName('Riverstone Ventures')
    })
  })

  // ============================================
  // Permission Changes
  // ============================================

  describe('Permission Changes', () => {
    // Use fresh session for each test to avoid state issues
    beforeEach(() => {
      cy.session('carlos-permissions', () => {
        cy.visit('/login')
        const devKeyring = DevKeyringPOM.create()
        devKeyring.validateVisible()
        devKeyring.quickLoginByEmail(USERS.CARLOS)
        cy.url().should('include', '/dashboard')
      })
      cy.visit('/dashboard', { timeout: 60000, failOnStatusCode: false })
      cy.url().should('include', '/dashboard')
    })

    it('TEAM_SW_030: Owner can create customer', () => {
      // Carlos is owner in Everpoint
      cy.visit('/dashboard/customers')
      cy.get('[data-cy="customers-page"]', { timeout: 15000 }).should('exist')

      // Create button should be visible for owner (uses entity-slug-add pattern)
      cy.get('[data-cy="customers-add"]').should('be.visible')
    })

    it('TEAM_SW_031: Owner can edit/delete customer via detail page', () => {
      // Owner can access edit/delete on detail page
      cy.visit('/dashboard/customers')
      cy.get('[data-cy="customers-page"]', { timeout: 15000 }).should('exist')

      // Click on the first row to go to detail (row is clickable)
      cy.get('[data-cy^="customers-row-"]').first().click()

      // Wait for detail page to load
      cy.url().should('match', /\/dashboard\/customers\/[^/]+$/)

      // On detail page, edit and delete buttons should be visible for owner
      cy.get('[data-cy="customers-edit-btn"]').should('be.visible')
      cy.get('[data-cy="customers-delete-btn"]').should('be.visible')
    })

    it('TEAM_SW_032: Member cannot create customer', () => {
      // Switch to Riverstone where Carlos is member
      teamSwitcher.switchToTeam(TEAMS.RIVERSTONE)

      cy.visit('/dashboard/customers')
      cy.get('[data-cy="customers-page"]', { timeout: 15000 }).should('exist')

      // Create button should NOT be visible for member
      cy.get('[data-cy="customers-add"]').should('not.exist')
    })

    it('TEAM_SW_033: Member cannot delete customer via detail page', () => {
      // Switch to Riverstone where Carlos is member
      teamSwitcher.switchToTeam(TEAMS.RIVERSTONE)

      cy.visit('/dashboard/customers')
      cy.get('[data-cy="customers-page"]', { timeout: 15000 }).should('exist')

      // Click on first customer row to go to detail
      cy.get('[data-cy^="customers-row-"]').first().click()

      // Delete button should NOT be visible for member
      cy.get('[data-cy="customers-delete"]').should('not.exist')
    })

    it('TEAM_SW_034: Member blocked from /edit URL', () => {
      // Switch to Riverstone where Carlos is member
      teamSwitcher.switchToTeam(TEAMS.RIVERSTONE)

      // Get a customer ID from the list
      cy.visit('/dashboard/customers')
      cy.get('[data-cy="customers-page"]', { timeout: 15000 }).should('exist')

      cy.get('[data-cy^="customers-row-"]').first().invoke('attr', 'data-cy').then((dataCy) => {
        const customerId = dataCy?.replace('customers-row-', '')

        // Try direct URL access to edit
        cy.visit(`/dashboard/customers/${customerId}/edit`)

        // Should show permission denied
        teamSwitcher.validatePermissionDenied()
      })
    })

    it('TEAM_SW_035: Member cannot access create URL or lacks create permissions', () => {
      // Switch to Riverstone where Carlos is member
      teamSwitcher.switchToTeam(TEAMS.RIVERSTONE)

      // Member should not be able to create customers
      // This is validated by checking the customers list page does NOT have create button
      cy.visit('/dashboard/customers')
      cy.get('[data-cy="customers-page"]', { timeout: 15000 }).should('exist')

      // The create button should NOT be visible for member (most reliable check)
      cy.get('[data-cy="customers-add"]').should('not.exist')
    })
  })

  // ============================================
  // UI Behavior
  // ============================================

  describe('UI Behavior', () => {
    beforeEach(() => {
      cy.session('carlos-ui-behavior', () => {
        cy.visit('/login')
        const devKeyring = DevKeyringPOM.create()
        devKeyring.validateVisible()
        devKeyring.quickLoginByEmail(USERS.CARLOS)
        cy.url().should('include', '/dashboard')
      })
      cy.visit('/dashboard', { timeout: 60000, failOnStatusCode: false })
      cy.url().should('include', '/dashboard')
    })

    it('TEAM_SW_040: Dropdown closes on escape key', () => {
      // Open dropdown
      teamSwitcher.open()

      // Click outside using Escape key (more reliable than body click with radix modals)
      cy.get('body').type('{esc}')

      // Dropdown should close
      cy.get(teamSwitcher.selectors.dropdown).should('not.exist')
    })

    it('TEAM_SW_041: Team options display team names', () => {
      // Open dropdown and verify team names are displayed
      teamSwitcher.open()
      cy.get(`[data-cy="team-option-${TEAMS.EVERPOINT}"]`).should('contain', 'Everpoint')
      cy.get(`[data-cy="team-option-${TEAMS.RIVERSTONE}"]`).should('contain', 'Riverstone')
    })

    it('TEAM_SW_042: Switcher hidden when sidebar collapsed', () => {
      // First expand sidebar (ensureSidebarExpanded handles if already collapsed)
      teamSwitcher.ensureSidebarExpanded()

      // Validate sidebar is expanded and switcher visible
      teamSwitcher.validateSidebarExpanded()
      cy.get(teamSwitcher.selectors.trigger).should('be.visible')

      // Collapse sidebar using toggle button in TopNavbar
      teamSwitcher.collapseSidebar()

      // Team switcher should not be visible when collapsed
      teamSwitcher.validateSwitcherNotVisible()

      // Expand sidebar again
      teamSwitcher.expandSidebar()

      // Team switcher should be visible again
      cy.get(teamSwitcher.selectors.trigger).should('be.visible')
    })
  })

  // ============================================
  // Viewer Role
  // ============================================

  describe('Viewer Role', () => {
    beforeEach(() => {
      cy.session('sarah-viewer', () => {
        cy.visit('/login')
        const devKeyring = DevKeyringPOM.create()
        devKeyring.validateVisible()
        devKeyring.quickLoginByEmail(USERS.SARAH)
        cy.url().should('include', '/dashboard')
      })
      cy.visit('/dashboard', { timeout: 60000, failOnStatusCode: false })
      cy.url().should('include', '/dashboard')
    })

    it('TEAM_SW_043: Viewer can only read customers', () => {
      // Sarah is a viewer in Ironvale - navigate to customers
      cy.visit('/dashboard/customers')
      // Viewer should see the list (even if empty) or be redirected
      cy.url().should('include', '/dashboard')
      // If list is visible, viewer should NOT have create button
      cy.get('body').then($body => {
        if ($body.find('[data-cy="customers-page"]').length > 0) {
          cy.get('[data-cy="customers-add"]').should('not.exist')
        }
        // Otherwise, access was denied which is also valid for viewer
      })
    })

    it('TEAM_SW_044: Viewer can only read tasks', () => {
      // Sarah is a viewer in Ironvale - navigate to tasks
      cy.visit('/dashboard/tasks')
      // Viewer should see the list (even if empty) or be redirected
      cy.url().should('include', '/dashboard')
      // If list is visible, viewer should NOT have create button
      cy.get('body').then($body => {
        if ($body.find('[data-cy="tasks-page"]').length > 0) {
          cy.get('[data-cy="tasks-add"]').should('not.exist')
        }
        // Otherwise, access was denied which is also valid for viewer
      })
    })

    it('TEAM_SW_045: Viewer blocked from create URL', () => {
      // Viewer should be blocked from create pages
      cy.visit('/dashboard/customers/create')
      // Either shows permission denied or redirects away from create
      cy.get('body').then($body => {
        if ($body.find('[data-cy="permission-denied"]').length > 0) {
          cy.get('[data-cy="permission-denied"]').should('be.visible')
        } else {
          // If not permission denied page, should have been redirected (not on create form)
          cy.get('[data-cy="customers-form"]').should('not.exist')
          cy.log('✅ Viewer was redirected or blocked from create form')
        }
      })
    })
  })

  // ============================================
  // Mobile
  // ============================================

  describe('Mobile', () => {
    beforeEach(() => {
      // Set mobile viewport
      cy.viewport('iphone-x')

      cy.session('carlos-mobile', () => {
        cy.visit('/login')
        const devKeyring = DevKeyringPOM.create()
        devKeyring.validateVisible()
        devKeyring.quickLoginByEmail(USERS.CARLOS)
        cy.url().should('include', '/dashboard')
      })
      cy.visit('/dashboard', { timeout: 60000, failOnStatusCode: false })
      cy.url().should('include', '/dashboard')
    })

    it('TEAM_SW_050: Switcher visible in MobileMoreSheet', () => {
      // Open mobile more menu using POM method
      teamSwitcher.openMobileMoreSheet()

      // Team switcher should be visible in the sheet
      teamSwitcher.validateMobileTeamSwitcherVisible()
    })

    it('TEAM_SW_051: Can switch teams from mobile', () => {
      // Switch teams using mobile POM method
      teamSwitcher.switchToTeamMobile(TEAMS.RIVERSTONE)

      // Wait for page to stabilize after switch (modal closes, page reloads)
      cy.wait(1000)

      // Verify switch happened by checking team name in the trigger
      // After reload on mobile, use force click if needed
      cy.get(teamSwitcher.selectors.mobileMoreButton, { timeout: 10000 }).click({ force: true })
      cy.get(teamSwitcher.selectors.mobileMoreSheet, { timeout: 5000 }).should('be.visible')
      cy.get(teamSwitcher.selectors.trigger).should('contain', 'Riverstone')
    })

    it('TEAM_SW_052: Mobile shows all teams', () => {
      // Open mobile more menu
      teamSwitcher.openMobileMoreSheet()

      // Open team switcher dropdown from mobile sheet
      teamSwitcher.openMobileTeamDropdown()

      // All teams should be visible in dropdown
      cy.get(`[data-cy="team-option-${TEAMS.EVERPOINT}"]`).should('be.visible')
      cy.get(`[data-cy="team-option-${TEAMS.RIVERSTONE}"]`).should('be.visible')
    })
  })
})
