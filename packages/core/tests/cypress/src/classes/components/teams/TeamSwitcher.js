/**
 * TeamSwitcher - Page Object Model Class
 *
 * POM for the TeamSwitcherCompact component in multi-tenant mode.
 * Used in sidebar footer and mobile MobileMoreSheet.
 */
export class TeamSwitcher {
  static selectors = {
    // TeamSwitcherCompact selectors
    trigger: '[data-cy="team-switcher-compact"]',
    dropdown: '[data-cy="team-switcher-dropdown"]',
    teamOption: '[data-cy^="team-option-"]',
    manageTeamsLink: '[data-cy="manage-teams-link"]',

    // TeamSwitchModal selectors
    switchModal: '[data-cy="team-switch-modal"]',

    // Sidebar selectors (toggle is in TopNavbar, not sidebar)
    sidebar: '[data-cy="sidebar-main"]',
    sidebarToggle: '[data-cy="topnav-sidebar-toggle"]', // In TopNavbar component

    // Mobile selectors
    mobileMoreButton: '[data-cy="mobile-bottomnav-item-more"]',
    mobileMoreSheet: '[data-cy="mobile-more-sheet-content"]',
    mobileTeamSwitcher: '[data-cy="mobile-more-sheet-team-switcher"]',

    // Permission selectors
    permissionDenied: '[data-cy="permission-denied"]',

    // Internal elements (not data-cy, used for validation)
    teamName: '.text-sm.font-medium',
    teamRole: '.text-xs.text-muted-foreground.capitalize',
    checkIcon: 'svg.lucide-check',
    avatar: '[class*="avatar"]',
  }

  /**
   * Ensure sidebar is expanded (required for TeamSwitcher to be visible)
   * The TeamSwitcherCompact only renders when sidebar is NOT collapsed
   * Note: User preferences may have sidebar collapsed by default
   * Note: Sidebar uses 'hidden lg:flex' - only visible on lg+ (1024px+)
   */
  ensureSidebarExpanded() {
    // First, wait for dashboard to be fully loaded
    cy.url().should('include', '/dashboard')

    // Wait for sidebar to exist and check collapsed state
    // Use cy.get without visibility check since sidebar uses Tailwind 'hidden lg:flex'
    cy.get(TeamSwitcher.selectors.sidebar, { timeout: 10000 })
      .should('exist')
      .invoke('attr', 'data-collapsed')
      .then(isCollapsed => {
        if (isCollapsed === 'true') {
          // Sidebar is collapsed - click toggle to expand
          cy.get(TeamSwitcher.selectors.sidebarToggle, { timeout: 5000 })
            .click({ force: true })
          // Wait for sidebar to be expanded
          cy.get(TeamSwitcher.selectors.sidebar)
            .should('have.attr', 'data-collapsed', 'false')
          // Give time for the TeamSwitcher component to render after expand
          cy.wait(500)
        }
      })
    return this
  }

  /**
   * Validate team switcher is visible
   * Note: This will first expand the sidebar if collapsed since
   * TeamSwitcherCompact only renders when sidebar is expanded
   */
  validateSwitcherVisible() {
    this.ensureSidebarExpanded()
    cy.get(TeamSwitcher.selectors.trigger).should('be.visible')
    return this
  }

  /**
   * Validate team switcher is NOT visible
   */
  validateSwitcherNotVisible() {
    cy.get(TeamSwitcher.selectors.trigger).should('not.exist')
    return this
  }

  /**
   * Open the team switcher dropdown (idempotent - only opens if closed)
   * Note: Ensures sidebar is expanded first
   */
  open() {
    this.ensureSidebarExpanded()
    cy.get('body').then($body => {
      // Only click if dropdown is not already visible
      if ($body.find(TeamSwitcher.selectors.dropdown).length === 0) {
        cy.get(TeamSwitcher.selectors.trigger).click()
      }
      cy.get(TeamSwitcher.selectors.dropdown).should('be.visible')
    })
    return this
  }

  /**
   * Close the team switcher dropdown by clicking outside
   */
  close() {
    cy.get('body').click(0, 0)
    cy.get(TeamSwitcher.selectors.dropdown).should('not.exist')
    return this
  }

  /**
   * Get the current team name displayed in the trigger button
   * Note: Ensures sidebar is expanded first
   */
  getCurrentTeamName() {
    this.ensureSidebarExpanded()
    return cy.get(TeamSwitcher.selectors.trigger)
      .find('.text-sm.font-medium')
      .invoke('text')
  }

  /**
   * Validate current team name in trigger button
   * Note: Ensures sidebar is expanded first
   * @param {string} teamName - Expected team name
   */
  validateCurrentTeamName(teamName) {
    this.ensureSidebarExpanded()
    cy.get(TeamSwitcher.selectors.trigger)
      .find('.text-sm.font-medium')
      .should('contain', teamName)
    return this
  }

  /**
   * Select a specific team by slug
   * @param {string} teamSlug - The team slug (e.g., 'everpoint-labs')
   */
  selectTeam(teamSlug) {
    this.open()
    cy.get(`[data-cy="team-option-${teamSlug}"]`).click()
    return this
  }

  /**
   * Select a team and wait for switch to complete
   * @param {string} teamSlug - The team slug
   */
  switchToTeam(teamSlug) {
    this.selectTeam(teamSlug)
    this.waitForSwitchComplete()
    return this
  }

  /**
   * Wait for the switch modal to appear and complete
   */
  waitForSwitchComplete() {
    // Modal appears
    cy.get(TeamSwitcher.selectors.switchModal, { timeout: 5000 }).should('be.visible')
    // Wait for modal to close (auto-closes after ~1.4s and triggers reload)
    cy.get(TeamSwitcher.selectors.switchModal, { timeout: 10000 }).should('not.exist')
    // Page reloads, wait for dashboard to be ready
    cy.url().should('include', '/dashboard')
    return this
  }

  /**
   * Validate the switch modal is visible
   */
  validateSwitchModalVisible() {
    cy.get(TeamSwitcher.selectors.switchModal).should('be.visible')
    return this
  }

  /**
   * Get the count of teams in the dropdown
   */
  getTeamCount() {
    this.open()
    return cy.get(TeamSwitcher.selectors.teamOption).its('length')
  }

  /**
   * Validate number of teams in dropdown
   * @param {number} count - Expected number of teams
   */
  validateTeamCount(count) {
    this.open()
    cy.get(TeamSwitcher.selectors.teamOption).should('have.length', count)
    return this
  }

  /**
   * Validate team exists in the list
   * @param {string} teamSlug - The team slug
   */
  validateTeamInList(teamSlug) {
    this.open()
    cy.get(`[data-cy="team-option-${teamSlug}"]`).should('exist')
    return this
  }

  /**
   * Validate team is NOT in the list
   * @param {string} teamSlug - The team slug
   */
  validateTeamNotInList(teamSlug) {
    this.open()
    cy.get(`[data-cy="team-option-${teamSlug}"]`).should('not.exist')
    return this
  }

  /**
   * Validate a team option shows the checkmark (is active)
   * @param {string} teamSlug - The team slug
   */
  validateTeamHasCheckmark(teamSlug) {
    this.open()
    cy.get(`[data-cy="team-option-${teamSlug}"]`)
      .find('svg.lucide-check')
      .should('exist')
    return this
  }

  /**
   * Validate a team option does NOT show the checkmark
   * @param {string} teamSlug - The team slug
   */
  validateTeamNoCheckmark(teamSlug) {
    this.open()
    cy.get(`[data-cy="team-option-${teamSlug}"]`)
      .find('svg.lucide-check')
      .should('not.exist')
    return this
  }

  /**
   * Validate the role displayed for a team
   * @param {string} teamSlug - The team slug
   * @param {string} role - Expected role text (e.g., 'Owner', 'Admin', 'Member')
   */
  validateRoleDisplayed(teamSlug, role) {
    this.open()
    cy.get(`[data-cy="team-option-${teamSlug}"]`)
      .find('.text-xs.text-muted-foreground')
      .should('contain.text', role)
    return this
  }

  /**
   * Validate team has an avatar or initials displayed
   * @param {string} teamSlug - The team slug
   */
  validateTeamHasAvatar(teamSlug) {
    this.open()
    cy.get(`[data-cy="team-option-${teamSlug}"]`)
      .find('[class*="avatar"]')
      .should('exist')
    return this
  }

  /**
   * Click Manage Teams link
   */
  clickManageTeams() {
    this.open()
    cy.get(TeamSwitcher.selectors.manageTeamsLink).click()
    return this
  }

  /**
   * Validate Manage Teams link is visible
   */
  validateManageTeamsVisible() {
    this.open()
    cy.get(TeamSwitcher.selectors.manageTeamsLink).should('be.visible')
    return this
  }

  /**
   * Navigate to Manage Teams and validate URL
   */
  goToManageTeams() {
    this.clickManageTeams()
    cy.url().should('include', '/dashboard/settings/teams')
    return this
  }

  /**
   * Get all team names from the dropdown
   * @returns {Cypress.Chainable<string[]>}
   */
  getTeamNames() {
    this.open()
    return cy.get(TeamSwitcher.selectors.teamOption)
      .find('.truncate')
      .then($elements => {
        return Cypress._.map($elements, el => el.innerText)
      })
  }

  // ============================================
  // Sidebar Methods
  // ============================================

  /**
   * Validate sidebar is visible and expanded
   */
  validateSidebarExpanded() {
    cy.get(TeamSwitcher.selectors.sidebar)
      .should('be.visible')
      .and('have.attr', 'data-collapsed', 'false')
    return this
  }

  /**
   * Validate sidebar is collapsed
   */
  validateSidebarCollapsed() {
    cy.get(TeamSwitcher.selectors.sidebar)
      .should('be.visible')
      .and('have.attr', 'data-collapsed', 'true')
    return this
  }

  /**
   * Click sidebar toggle button to collapse/expand
   */
  toggleSidebar() {
    cy.get(TeamSwitcher.selectors.sidebarToggle).click()
    return this
  }

  /**
   * Collapse sidebar and wait for animation
   */
  collapseSidebar() {
    cy.get(TeamSwitcher.selectors.sidebar).then($sidebar => {
      if ($sidebar.attr('data-collapsed') === 'false') {
        this.toggleSidebar()
        cy.get(TeamSwitcher.selectors.sidebar).should('have.attr', 'data-collapsed', 'true')
      }
    })
    return this
  }

  /**
   * Expand sidebar and wait for animation
   */
  expandSidebar() {
    cy.get(TeamSwitcher.selectors.sidebar).then($sidebar => {
      if ($sidebar.attr('data-collapsed') === 'true') {
        this.toggleSidebar()
        cy.get(TeamSwitcher.selectors.sidebar).should('have.attr', 'data-collapsed', 'false')
      }
    })
    return this
  }

  // ============================================
  // Mobile Methods
  // ============================================

  /**
   * Open the mobile more sheet
   */
  openMobileMoreSheet() {
    cy.get(TeamSwitcher.selectors.mobileMoreButton).click()
    cy.get(TeamSwitcher.selectors.mobileMoreSheet).should('be.visible')
    return this
  }

  /**
   * Validate mobile more sheet is visible
   */
  validateMobileMoreSheetVisible() {
    cy.get(TeamSwitcher.selectors.mobileMoreSheet).should('be.visible')
    return this
  }

  /**
   * Validate team switcher is visible in mobile more sheet
   */
  validateMobileTeamSwitcherVisible() {
    cy.get(TeamSwitcher.selectors.mobileMoreSheet).within(() => {
      cy.get(TeamSwitcher.selectors.trigger).should('be.visible')
    })
    return this
  }

  /**
   * Open team dropdown from mobile more sheet
   */
  openMobileTeamDropdown() {
    cy.get(TeamSwitcher.selectors.mobileMoreSheet).within(() => {
      cy.get(TeamSwitcher.selectors.trigger).click()
    })
    return this
  }

  /**
   * Switch team from mobile view
   * @param {string} teamSlug - The team slug
   */
  switchToTeamMobile(teamSlug) {
    this.openMobileMoreSheet()
    this.openMobileTeamDropdown()
    cy.get(`[data-cy="team-option-${teamSlug}"]`).click()
    this.waitForSwitchComplete()
    return this
  }

  // ============================================
  // Permission Methods
  // ============================================

  /**
   * Validate permission denied page is visible
   */
  validatePermissionDenied() {
    cy.get(TeamSwitcher.selectors.permissionDenied).should('be.visible')
    return this
  }

  /**
   * Validate permission denied page is NOT visible
   */
  validateNoPermissionDenied() {
    cy.get(TeamSwitcher.selectors.permissionDenied).should('not.exist')
    return this
  }
}
