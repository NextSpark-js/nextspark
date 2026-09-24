export class DashboardPage {
  static selectors = {
    dashboard: '[data-cy="dashboard"]',
    title: '[data-cy="dashboard-title"]',
    userMenu: '[data-cy="user-menu"]',
    logoutButton: '[data-cy="logout-button"]',
    content: '[data-cy="dashboard-content"]',
    navigation: '[data-cy="dashboard-nav"]'
  }

  // Verification methods
  verifyDashboardVisible() {
    cy.get(DashboardPage.selectors.dashboard).should('be.visible')
    return this
  }

  verifyTitle(expectedTitle = 'Dashboard') {
    cy.get('h1').should('contain.text', expectedTitle)
    return this
  }

  verifyUserMenuVisible() {
    cy.get(DashboardPage.selectors.userMenu).should('be.visible')
    return this
  }

  // Actions
  clickUserMenu() {
    cy.get(DashboardPage.selectors.userMenu).should('be.visible').click()
    return this
  }

  clickLogout() {
    cy.get(DashboardPage.selectors.logoutButton).should('be.visible').click()
    return this
  }

  logout() {
    this.clickUserMenu()
    this.clickLogout()
    return this
  }
}
