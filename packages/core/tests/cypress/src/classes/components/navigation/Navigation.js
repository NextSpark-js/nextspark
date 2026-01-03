/**
 * Navigation - Encapsula elementos de navegación globales
 * 
 * Maneja elementos de navegación que aparecen en múltiples páginas
 * como barras de navegación, menús, etc.
 */
export class Navigation {
  // 🎯 Selectores centralizados
  static selectors = {
    topNavbar: '[data-cy="top-navbar"]',
    sidebar: '[data-cy="sidebar-main"]',
    userMenu: '[data-cy="topnav-user-menu-trigger"]',
    logo: '[data-cy="app-logo"]',
    searchDropdown: '[data-cy="search-dropdown"]',
    notificationsDropdown: '[data-cy="notifications-dropdown"]'
  }

  /**
   * Valida que la navegación principal está presente
   */
  validateMainNavigation() {
    cy.get(Navigation.selectors.topNavbar).should('be.visible')
    cy.get(Navigation.selectors.sidebar).should('be.visible')
    
    return this
  }

  /**
   * Clicks en el menú de usuario
   */
  openUserMenu() {
    cy.get(Navigation.selectors.userMenu).click()
    
    return this
  }

  /**
   * Navega a una ruta específica usando la navegación
   * @param {string} route - Ruta a la que navegar
   */
  navigateTo(route) {
    cy.visit(route)
    
    return this
  }
}
