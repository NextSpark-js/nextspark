/**
 * TeamsTable - Page Object Model Class
 *
 * POM for Sector7 Teams Management page.
 * Handles teams listing, filtering, and table validation.
 */
export class TeamsTable {
  static selectors = {
    // Page structure
    pageTitle: 'h1',
    searchInput: '[data-cy="teams-search-input"]',
    clearSearchBtn: '[data-cy="clear-search-btn"]',

    // Stats cards
    statsGrid: '.grid.grid-cols-1.md\\:grid-cols-3',
    totalTeamsCard: '.text-2xl.font-bold',

    // Tabs
    tabsList: '[role="tablist"]',
    workTeamsTab: '[value="work"]',
    personalTeamsTab: '[value="personal"]',

    // Table
    teamsTable: 'table',
    tableHeader: 'thead',
    tableBody: 'tbody',
    tableRow: 'tr',
    teamRow: '[data-cy^="team-row-"]',
    teamActions: '[data-cy^="team-actions-"]',

    // Loading/Empty states
    loadingSpinner: '.animate-spin',
    emptyState: '.text-center.py-8',
  }

  /**
   * Validate teams page is loaded
   */
  validateTeamsPageLoaded() {
    cy.url().should('include', '/sector7/teams')
    cy.contains('h1', 'Team Management').should('be.visible')

    return this
  }

  /**
   * Validate teams table is visible and loaded
   */
  validateTeamsTableLoaded() {
    cy.get(TeamsTable.selectors.teamsTable).should('be.visible')
    cy.get(TeamsTable.selectors.tableHeader).should('be.visible')

    return this
  }

  /**
   * Validate table structure (columns)
   */
  validateTableStructure() {
    cy.get(TeamsTable.selectors.tableHeader).within(() => {
      cy.contains('Team').should('be.visible')
      cy.contains('Owner').should('be.visible')
      cy.contains('Members').should('be.visible')
      cy.contains('Created').should('be.visible')
      cy.contains('Actions').should('be.visible')
    })

    return this
  }

  /**
   * Validate minimum number of teams exist in table
   * @param {number} minimumCount - Expected minimum teams
   */
  validateTeamsExist(minimumCount = 1) {
    cy.get(TeamsTable.selectors.teamRow).should('have.length.at.least', minimumCount)

    return this
  }

  /**
   * Validate stats cards are visible
   */
  validateStatsVisible() {
    cy.get(TeamsTable.selectors.totalTeamsCard).should('be.visible')

    return this
  }

  /**
   * Switch to Work Teams tab
   */
  switchToWorkTeams() {
    cy.get(TeamsTable.selectors.workTeamsTab).click()

    return this
  }

  /**
   * Switch to Personal Teams tab
   */
  switchToPersonalTeams() {
    cy.get(TeamsTable.selectors.personalTeamsTab).click()

    return this
  }

  /**
   * Search teams by query
   * @param {string} query - Search query
   */
  searchTeams(query) {
    cy.get(TeamsTable.selectors.searchInput).clear().type(query)

    return this
  }

  /**
   * Clear search filter
   */
  clearSearch() {
    cy.get(TeamsTable.selectors.clearSearchBtn).click()

    return this
  }

  /**
   * Validate loading state is shown
   */
  validateLoadingState() {
    cy.get(TeamsTable.selectors.loadingSpinner).should('be.visible')

    return this
  }

  /**
   * Validate empty state when no teams
   */
  validateEmptyState() {
    cy.get(TeamsTable.selectors.emptyState).should('be.visible')
    cy.contains('No teams found').should('be.visible')

    return this
  }

  /**
   * Click on a specific team row to view details
   * @param {string} teamId - Team ID
   */
  clickTeamRow(teamId) {
    cy.get(`[data-cy="team-row-${teamId}"]`).click()
    cy.url().should('include', `/sector7/teams/${teamId}`)

    return this
  }

  /**
   * Open team actions menu
   * @param {string} teamId - Team ID
   */
  openTeamActions(teamId) {
    cy.get(`[data-cy="team-actions-${teamId}"]`).click()

    return this
  }
}
