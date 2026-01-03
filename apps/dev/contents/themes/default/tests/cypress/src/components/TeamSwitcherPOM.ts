/**
 * TeamSwitcherPOM - Page Object Model for TeamSwitcherCompact component
 *
 * POM for the team switcher in multi-tenant mode.
 * Used in sidebar footer and mobile MobileMoreSheet.
 *
 * @version 3.0 - Uses centralized selectors from cySelector()
 */
import { BasePOM } from '../core/BasePOM'
import { cySelector } from '../selectors'

export class TeamSwitcherPOM extends BasePOM {
  /**
   * Selectors using centralized cySelector()
   */
  get selectors() {
    return {
      // TeamSwitcherCompact selectors
      trigger: cySelector('teams.switcher.compact'),
      dropdown: cySelector('teams.switcher.dropdown'),
      // Prefix selector for all team options
      teamOption: '[data-cy^="team-option-"]',
      teamOptionBySlug: (slug: string) => cySelector('teams.switcher.option', { slug }),
      manageTeamsLink: cySelector('teams.switcher.manageLink'),

      // TeamSwitchModal selectors
      switchModal: cySelector('teams.switchModal.container'),

      // Sidebar selectors (toggle is in TopNavbar, not sidebar)
      sidebar: cySelector('dashboard.sidebar.main'),
      sidebarToggle: cySelector('dashboard.topnav.sidebarToggle'),

      // Mobile selectors
      mobileMoreButton: cySelector('dashboard.mobile.bottomNav.item', { id: 'more' }),
      mobileMoreSheet: cySelector('dashboard.mobile.moreSheet.content'),
      mobileTeamSwitcher: cySelector('dashboard.mobile.moreSheet.teamSwitcher'),

      // Permission selectors
      permissionDenied: cySelector('common.permissionDenied'),

      // Internal elements (CSS classes, used for validation)
      teamName: '.text-sm.font-medium',
      teamRole: '.text-xs.text-muted-foreground.capitalize',
      checkIcon: 'svg.lucide-check',
      avatar: '[class*="avatar"]',
    }
  }

  /**
   * Factory method - creates a new instance
   */
  static create(): TeamSwitcherPOM {
    return new TeamSwitcherPOM()
  }

  // ============================================
  // Sidebar Methods
  // ============================================

  /**
   * Ensure sidebar is expanded (required for TeamSwitcher to be visible)
   * The TeamSwitcherCompact only renders when sidebar is NOT collapsed
   */
  ensureSidebarExpanded(): this {
    // Wait for dashboard to be fully loaded
    cy.url().should('include', '/dashboard')

    // First check if sidebar exists and wait for it to be visible
    cy.get(this.selectors.sidebar, { timeout: 15000 }).should('be.visible')

    // Check if collapsed and expand if needed
    cy.get(this.selectors.sidebar).then($sidebar => {
      const isCollapsed = $sidebar.attr('data-collapsed')
      if (isCollapsed === 'true') {
        // Click toggle to expand
        cy.get(this.selectors.sidebarToggle, { timeout: 5000 })
          .should('be.visible')
          .click({ force: true })
        // Wait for expansion animation
        cy.get(this.selectors.sidebar, { timeout: 5000 })
          .should('have.attr', 'data-collapsed', 'false')
        // Wait for team switcher to render
        cy.wait(300)
      }
    })

    // Final assertion that sidebar is expanded
    cy.get(this.selectors.sidebar).should('have.attr', 'data-collapsed', 'false')
    return this
  }

  /**
   * Validate sidebar is visible and expanded
   */
  validateSidebarExpanded(): this {
    cy.get(this.selectors.sidebar)
      .should('be.visible')
      .and('have.attr', 'data-collapsed', 'false')
    return this
  }

  /**
   * Validate sidebar is collapsed
   */
  validateSidebarCollapsed(): this {
    cy.get(this.selectors.sidebar)
      .should('be.visible')
      .and('have.attr', 'data-collapsed', 'true')
    return this
  }

  /**
   * Click sidebar toggle button to collapse/expand
   */
  toggleSidebar(): this {
    cy.get(this.selectors.sidebarToggle).click()
    return this
  }

  /**
   * Collapse sidebar and wait for animation
   */
  collapseSidebar(): this {
    cy.get(this.selectors.sidebar).then($sidebar => {
      if ($sidebar.attr('data-collapsed') === 'false') {
        this.toggleSidebar()
        cy.get(this.selectors.sidebar).should('have.attr', 'data-collapsed', 'true')
      }
    })
    return this
  }

  /**
   * Expand sidebar and wait for animation
   */
  expandSidebar(): this {
    cy.get(this.selectors.sidebar).then($sidebar => {
      if ($sidebar.attr('data-collapsed') === 'true') {
        this.toggleSidebar()
        cy.get(this.selectors.sidebar).should('have.attr', 'data-collapsed', 'false')
      }
    })
    return this
  }

  // ============================================
  // Team Switcher Core Methods
  // ============================================

  /**
   * Validate team switcher is visible
   */
  validateSwitcherVisible(): this {
    this.ensureSidebarExpanded()
    cy.get(this.selectors.trigger).should('be.visible')
    return this
  }

  /**
   * Validate team switcher is NOT visible
   */
  validateSwitcherNotVisible(): this {
    cy.get(this.selectors.trigger).should('not.exist')
    return this
  }

  /**
   * Open the team switcher dropdown (idempotent)
   */
  open(): this {
    this.ensureSidebarExpanded()
    cy.get('body').then($body => {
      if ($body.find(this.selectors.dropdown).length === 0) {
        cy.get(this.selectors.trigger).click()
      }
      cy.get(this.selectors.dropdown).should('be.visible')
    })
    return this
  }

  /**
   * Close the team switcher dropdown
   */
  close(): this {
    cy.get('body').click(0, 0)
    cy.get(this.selectors.dropdown).should('not.exist')
    return this
  }

  /**
   * Get the current team name displayed in the trigger button
   */
  getCurrentTeamName(): Cypress.Chainable<string> {
    this.ensureSidebarExpanded()
    return cy.get(this.selectors.trigger)
      .find(this.selectors.teamName)
      .invoke('text')
  }

  /**
   * Validate current team name in trigger button
   */
  validateCurrentTeamName(teamName: string): this {
    this.ensureSidebarExpanded()
    cy.get(this.selectors.trigger)
      .find(this.selectors.teamName)
      .should('contain', teamName)
    return this
  }

  // ============================================
  // Team Selection Methods
  // ============================================

  /**
   * Select a specific team by slug (opens dropdown, clicks team)
   */
  selectTeam(teamSlug: string): this {
    this.open()
    cy.get(this.selectors.teamOptionBySlug(teamSlug)).click()
    return this
  }

  /**
   * Select a team and wait for switch to complete
   */
  switchToTeam(teamSlug: string): this {
    this.selectTeam(teamSlug)
    this.waitForSwitchComplete()
    return this
  }

  /**
   * Wait for the switch modal to appear and complete
   */
  waitForSwitchComplete(): this {
    cy.get(this.selectors.switchModal, { timeout: 5000 }).should('be.visible')
    cy.get(this.selectors.switchModal, { timeout: 10000 }).should('not.exist')
    cy.url().should('include', '/dashboard')
    return this
  }

  /**
   * Validate the switch modal is visible
   */
  validateSwitchModalVisible(): this {
    cy.get(this.selectors.switchModal).should('be.visible')
    return this
  }

  // ============================================
  // Team Validation Methods
  // ============================================

  /**
   * Get the count of teams in the dropdown
   */
  getTeamCount(): Cypress.Chainable<number> {
    this.open()
    return cy.get(this.selectors.teamOption).its('length')
  }

  /**
   * Validate number of teams in dropdown
   */
  validateTeamCount(count: number): this {
    this.open()
    cy.get(this.selectors.teamOption).should('have.length', count)
    return this
  }

  /**
   * Validate team exists in the list
   */
  validateTeamInList(teamSlug: string): this {
    this.open()
    cy.get(this.selectors.teamOptionBySlug(teamSlug)).should('exist')
    return this
  }

  /**
   * Validate team is NOT in the list
   */
  validateTeamNotInList(teamSlug: string): this {
    this.open()
    cy.get(this.selectors.teamOptionBySlug(teamSlug)).should('not.exist')
    return this
  }

  /**
   * Validate a team option shows the checkmark (is active)
   */
  validateTeamHasCheckmark(teamSlug: string): this {
    this.open()
    cy.get(this.selectors.teamOptionBySlug(teamSlug))
      .find(this.selectors.checkIcon)
      .should('exist')
    return this
  }

  /**
   * Validate a team option does NOT show the checkmark
   */
  validateTeamNoCheckmark(teamSlug: string): this {
    this.open()
    cy.get(this.selectors.teamOptionBySlug(teamSlug))
      .find(this.selectors.checkIcon)
      .should('not.exist')
    return this
  }

  /**
   * Validate the role displayed for a team
   */
  validateRoleDisplayed(teamSlug: string, role: string): this {
    this.open()
    cy.get(this.selectors.teamOptionBySlug(teamSlug))
      .find('.text-xs.text-muted-foreground')
      .should('contain.text', role)
    return this
  }

  /**
   * Validate team has an avatar or initials displayed
   */
  validateTeamHasAvatar(teamSlug: string): this {
    this.open()
    cy.get(this.selectors.teamOptionBySlug(teamSlug))
      .find(this.selectors.avatar)
      .should('exist')
    return this
  }

  /**
   * Get all team names from the dropdown
   */
  getTeamNames(): Cypress.Chainable<string[]> {
    this.open()
    return cy.get(this.selectors.teamOption)
      .find('.truncate')
      .then($elements => {
        return Cypress._.map($elements, el => el.innerText)
      })
  }

  // ============================================
  // Manage Teams Methods
  // ============================================

  /**
   * Click Manage Teams link
   */
  clickManageTeams(): this {
    this.open()
    cy.get(this.selectors.manageTeamsLink).click()
    return this
  }

  /**
   * Validate Manage Teams link is visible
   */
  validateManageTeamsVisible(): this {
    this.open()
    cy.get(this.selectors.manageTeamsLink).should('be.visible')
    return this
  }

  /**
   * Navigate to Manage Teams and validate URL
   */
  goToManageTeams(): this {
    this.clickManageTeams()
    cy.url().should('include', '/dashboard/settings/teams')
    return this
  }

  // ============================================
  // Mobile Methods
  // ============================================

  /**
   * Open the mobile more sheet
   */
  openMobileMoreSheet(): this {
    cy.get(this.selectors.mobileMoreButton).click()
    cy.get(this.selectors.mobileMoreSheet).should('be.visible')
    return this
  }

  /**
   * Validate mobile more sheet is visible
   */
  validateMobileMoreSheetVisible(): this {
    cy.get(this.selectors.mobileMoreSheet).should('be.visible')
    return this
  }

  /**
   * Validate team switcher is visible in mobile more sheet
   */
  validateMobileTeamSwitcherVisible(): this {
    cy.get(this.selectors.mobileMoreSheet).within(() => {
      cy.get(this.selectors.trigger).should('be.visible')
    })
    return this
  }

  /**
   * Open team dropdown from mobile more sheet
   */
  openMobileTeamDropdown(): this {
    cy.get(this.selectors.mobileMoreSheet).within(() => {
      cy.get(this.selectors.trigger).click()
    })
    return this
  }

  /**
   * Switch team from mobile view
   */
  switchToTeamMobile(teamSlug: string): this {
    this.openMobileMoreSheet()
    this.openMobileTeamDropdown()
    cy.get(this.selectors.teamOptionBySlug(teamSlug)).click()
    this.waitForSwitchComplete()
    return this
  }

  // ============================================
  // Permission Methods
  // ============================================

  /**
   * Validate permission denied page is visible
   */
  validatePermissionDenied(): this {
    cy.get(this.selectors.permissionDenied).should('be.visible')
    return this
  }

  /**
   * Validate permission denied page is NOT visible
   */
  validateNoPermissionDenied(): this {
    cy.get(this.selectors.permissionDenied).should('not.exist')
    return this
  }
}

export default TeamSwitcherPOM
