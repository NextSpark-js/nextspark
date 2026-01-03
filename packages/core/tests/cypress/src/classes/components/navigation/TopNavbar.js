/**
 * TopNavbar - Page Object Model Class
 * 
 * Encapsula toda la funcionalidad de la barra de navegación superior
 * Mapea test cases: NAV_013-020 de top-navbar.cy.md
 */
export class TopNavbar {
  static selectors = {
    // Contenedores principales
    header: '[data-cy="topnav-header"]',
    logo: '[data-cy="topnav-logo"]',
    actions: '[data-cy="topnav-actions"]',
    
    // Búsqueda
    searchSection: '[data-cy="topnav-search-section"]',
    searchInput: '[data-cy="topnav-search-input"]',
    searchResults: '[data-cy="topnav-search-results"]',
    
    // Acciones principales
    notifications: '[data-cy="topnav-notifications"]',
    help: '[data-cy="topnav-help"]',
    themeToggle: '[data-cy="topnav-theme-toggle"]',
    sector7Link: '[data-cy="topnav-sector7"]',
    
    // Usuario autenticado
    userMenuTrigger: '[data-cy="topnav-user-menu-trigger"]',
    userMenu: '[data-cy="topnav-user-menu"]',
    userLoading: '[data-cy="topnav-user-loading"]',
    
    // Menu items del usuario (actions use camelCase from item.action)
    menuProfile: '[data-cy="topnav-menu-profile"]',
    menuSettings: '[data-cy="topnav-menu-settings"]',
    menuBilling: '[data-cy="topnav-menu-billing"]',
    menuSignOut: '[data-cy="topnav-menu-signOut"]',
    
    // Usuario no autenticado
    signin: '[data-cy="topnav-signin"]',
    signup: '[data-cy="topnav-signup"]',
    
    // Móvil
    mobileActions: '[data-cy="topnav-mobile-actions"]',
    mobileMenuToggle: '[data-cy="topnav-mobile-menu-toggle"]',
    mobileMenu: '[data-cy="topnav-mobile-menu"]',
    
    // Navegación móvil
    mobileNavDashboard: '[data-cy="topnav-mobile-nav-dashboard"]',
    mobileNavTasks: '[data-cy="topnav-mobile-nav-tasks"]',
    mobileNavSector7: '[data-cy="topnav-mobile-nav-sector7"]',
    
    // Usuario móvil
    mobileUserInfo: '[data-cy="topnav-mobile-user-info"]',
    mobileLinkProfile: '[data-cy="topnav-mobile-link-profile"]',
    mobileLinkSettings: '[data-cy="topnav-mobile-link-settings"]',
    mobileLinkBilling: '[data-cy="topnav-mobile-link-billing"]',
    mobileSignout: '[data-cy="topnav-mobile-signout"]',
    mobileSignin: '[data-cy="topnav-mobile-signin"]',
    mobileSignup: '[data-cy="topnav-mobile-signup"]',
  }

  /**
   * Valida que la barra de navegación está visible y cargada
   */
  validateTopNavbarVisible() {
    cy.get(TopNavbar.selectors.header).should('be.visible')
    cy.get(TopNavbar.selectors.logo).should('be.visible')
    cy.get(TopNavbar.selectors.actions).should('be.visible')
    
    return this
  }

  /**
   * Valida elementos para usuario autenticado
   */
  validateAuthenticatedUser() {
    cy.get(TopNavbar.selectors.userMenuTrigger).should('be.visible')
    cy.get(TopNavbar.selectors.notifications).should('be.visible')
    cy.get(TopNavbar.selectors.themeToggle).should('be.visible')
    
    // No debería mostrar login/signup
    cy.get(TopNavbar.selectors.signin).should('not.exist')
    cy.get(TopNavbar.selectors.signup).should('not.exist')
    
    return this
  }

  /**
   * Valida elementos para usuario no autenticado
   */
  validateUnauthenticatedUser() {
    cy.get(TopNavbar.selectors.signin).should('be.visible')
    cy.get(TopNavbar.selectors.signup).should('be.visible')
    cy.get(TopNavbar.selectors.themeToggle).should('be.visible')
    
    // No debería mostrar elementos de usuario autenticado
    cy.get(TopNavbar.selectors.userMenuTrigger).should('not.exist')
    cy.get(TopNavbar.selectors.notifications).should('not.exist')
    
    return this
  }

  /**
   * Abre el menú de usuario
   */
  openUserMenu() {
    cy.get(TopNavbar.selectors.userMenuTrigger).click()
    cy.get(TopNavbar.selectors.userMenu).should('be.visible')
    
    return this
  }

  /**
   * Cierra el menú de usuario
   */
  closeUserMenu() {
    // Click fuera del menú
    cy.get('body').click(0, 0)
    cy.get(TopNavbar.selectors.userMenu).should('not.be.visible')
    
    return this
  }

  /**
   * Navega a perfil desde menú de usuario
   */
  navigateToProfile() {
    this.openUserMenu()
    cy.get(TopNavbar.selectors.menuProfile).click()
    cy.url().should('include', '/profile')
    
    return this
  }

  /**
   * Navega a configuraciones desde menú de usuario
   */
  navigateToSettings() {
    this.openUserMenu()
    cy.get(TopNavbar.selectors.menuSettings).click()
    cy.url().should('include', '/settings')
    
    return this
  }

  /**
   * Navega a billing desde menú de usuario
   */
  navigateToBilling() {
    this.openUserMenu()
    cy.get(TopNavbar.selectors.menuBilling).click()
    cy.url().should('include', '/billing')
    
    return this
  }

  /**
   * Realiza logout desde menú de usuario
   */
  logout() {
    this.openUserMenu()
    cy.get(TopNavbar.selectors.menuSignOut).click()
    cy.url().should('include', '/login')

    return this
  }

  /**
   * Navega a login
   */
  navigateToLogin() {
    cy.get(TopNavbar.selectors.signin).click()
    cy.url().should('include', '/login')
    
    return this
  }

  /**
   * Navega a registro
   */
  navigateToSignup() {
    cy.get(TopNavbar.selectors.signup).click()
    cy.url().should('include', '/signup')
    
    return this
  }

  /**
   * Navega a Sector7 (solo para superadmin)
   */
  navigateToSector7() {
    cy.get(TopNavbar.selectors.sector7Link).click()
    cy.url().should('include', '/sector7')
    
    return this
  }

  /**
   * Alterna tema (dark/light)
   */
  toggleTheme() {
    cy.get(TopNavbar.selectors.themeToggle).click()
    
    // Verificar que el tema cambió
    cy.get('html').should('have.attr', 'data-theme')
    
    return this
  }

  /**
   * Realiza búsqueda
   */
  search(query) {
    cy.get(TopNavbar.selectors.searchInput)
      .clear()
      .type(query)
      .type('{enter}')
    
    return this
  }

  /**
   * Valida resultados de búsqueda
   */
  validateSearchResults() {
    cy.get(TopNavbar.selectors.searchResults).should('be.visible')
    cy.get(TopNavbar.selectors.searchResults).within(() => {
      cy.get('[data-cy="search-result-item"]').should('have.length.at.least', 1)
    })
    
    return this
  }

  /**
   * Abre centro de notificaciones
   */
  openNotifications() {
    cy.get(TopNavbar.selectors.notifications).click()
    cy.get('[data-cy="notifications-dropdown"]').should('be.visible')
    
    return this
  }

  /**
   * Valida comportamiento móvil
   */
  validateMobileBehavior() {
    cy.viewport(375, 667)
    
    // Elementos desktop no deberían estar visibles
    cy.get(TopNavbar.selectors.actions).should('not.be.visible')
    
    // Elementos móviles deberían estar visibles
    cy.get(TopNavbar.selectors.mobileActions).should('be.visible')
    cy.get(TopNavbar.selectors.mobileMenuToggle).should('be.visible')
    
    return this
  }

  /**
   * Abre menú móvil
   */
  openMobileMenu() {
    cy.get(TopNavbar.selectors.mobileMenuToggle).click()
    cy.get(TopNavbar.selectors.mobileMenu).should('be.visible')
    
    return this
  }

  /**
   * Navega en móvil a Dashboard
   */
  mobileNavigateToDashboard() {
    this.openMobileMenu()
    cy.get(TopNavbar.selectors.mobileNavDashboard).click()
    cy.url().should('include', '/dashboard')
    
    return this
  }

  /**
   * Navega en móvil a Tasks
   */
  mobileNavigateToTasks() {
    this.openMobileMenu()
    cy.get(TopNavbar.selectors.mobileNavTasks).click()
    cy.url().should('include', '/tasks')
    
    return this
  }

  /**
   * Logout en móvil
   */
  mobileLogout() {
    this.openMobileMenu()
    cy.get(TopNavbar.selectors.mobileSignout).click()
    cy.url().should('include', '/login')
    
    return this
  }

  /**
   * Login en móvil
   */
  mobileNavigateToLogin() {
    this.openMobileMenu()
    cy.get(TopNavbar.selectors.mobileSignin).click()
    cy.url().should('include', '/login')
    
    return this
  }

  /**
   * Valida logo y navegación home
   */
  validateLogo() {
    cy.get(TopNavbar.selectors.logo)
      .should('be.visible')
      .and('have.attr', 'alt')
    
    cy.get(TopNavbar.selectors.logo).click()
    cy.url().should('include', '/dashboard')
    
    return this
  }

  /**
   * Valida accesibilidad
   */
  validateAccessibility() {
    // Verificar ARIA labels
    cy.get(TopNavbar.selectors.userMenuTrigger)
      .should('have.attr', 'aria-label')
      .or('have.attr', 'aria-describedby')
    
    // Navegación por teclado
    cy.get(TopNavbar.selectors.userMenuTrigger).focus()
    cy.get(TopNavbar.selectors.userMenuTrigger).should('be.focused')
    
    // Abrir menú con Enter
    cy.get(TopNavbar.selectors.userMenuTrigger).type('{enter}')
    cy.get(TopNavbar.selectors.userMenu).should('be.visible')
    
    return this
  }

  /**
   * Valida estado de loading para usuario
   */
  validateUserLoading() {
    cy.get(TopNavbar.selectors.userLoading).should('be.visible')
    
    return this
  }

  /**
   * Valida elementos según rol de usuario
   */
  validateUserRole(role) {
    if (role === 'superadmin') {
      cy.get(TopNavbar.selectors.sector7Link).should('be.visible')
    } else {
      cy.get(TopNavbar.selectors.sector7Link).should('not.exist')
    }
    
    return this
  }

  /**
   * Valida breadcrumb navigation
   */
  validateBreadcrumb(currentPage) {
    cy.get('[data-cy="breadcrumb-nav"]').should('be.visible')
    cy.get('[data-cy="breadcrumb-current"]').should('contain.text', currentPage)
    
    return this
  }

  /**
   * Valida estado sticky del navbar
   */
  validateStickyBehavior() {
    // Scroll hacia abajo
    cy.scrollTo(0, 500)
    
    // Navbar debería seguir visible (sticky)
    cy.get(TopNavbar.selectors.header).should('be.visible')
    
    return this
  }

  // ========================================
  // MÉTODOS REQUERIDOS POR LOS TESTS
  // ========================================

  /**
   * Valida que no hay acceso a Sector7
   */
  validateNoSector7Access() {
    cy.get(TopNavbar.selectors.sector7Link).should('not.exist')
    return this
  }

  /**
   * Valida que existe acceso a Sector7
   */
  validateSector7Access() {
    cy.get(TopNavbar.selectors.sector7Link).should('be.visible')
    return this
  }

  /**
   * Valida un item específico en el breadcrumb
   */
  validateBreadcrumbItem(itemName) {
    cy.get('[data-cy="breadcrumb-nav"]').should('be.visible')
    cy.get('[data-cy="breadcrumb-nav"]').should('contain.text', itemName)
    return this
  }

  /**
   * Valida comportamiento responsive
   */
  validateResponsiveBehavior() {
    // Verificar en móvil
    cy.viewport('iphone-6')
    cy.get(TopNavbar.selectors.mobileMenuToggle).should('be.visible')
    
    // Verificar en desktop
    cy.viewport(1280, 720)
    cy.get(TopNavbar.selectors.actions).should('be.visible')
    
    return this
  }

  /**
   * Valida accesibilidad del navbar
   */
  validateAccessibility() {
    // Verificar navegación por teclado
    cy.get(TopNavbar.selectors.userMenuTrigger).focus()
    cy.tab()
    
    // Verificar aria-labels
    cy.get(TopNavbar.selectors.userMenuTrigger)
      .should('have.attr', 'aria-label')
      .or('have.attr', 'aria-labelledby')
    
    return this
  }
}
