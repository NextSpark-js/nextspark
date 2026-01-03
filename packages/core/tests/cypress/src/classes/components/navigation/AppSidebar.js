/**
 * AppSidebar - Page Object Model Class
 * 
 * Encapsula toda la funcionalidad del sidebar principal de la aplicación
 * Mapea test cases: NAV_001-012 de app-sidebar.cy.md
 */
export class AppSidebar {
  static selectors = {
    // Contenedores principales
    main: '[data-cy="sidebar-main"]',
    nav: '[data-cy="sidebar-nav"]',
    navItems: '[data-cy="sidebar-nav-items"]',
    
    // Header del sidebar
    headerSection: '[data-cy="sidebar-header-section"]',
    logo: '[data-cy="sidebar-logo"]',
    toggle: '[data-cy="sidebar-toggle"]',
    
    // Elementos de navegación dinámicos
    navDashboard: '[data-cy="sidebar-nav-dashboard"]',
    navTasks: '[data-cy="sidebar-nav-tasks"]',
    navSettings: '[data-cy="sidebar-nav-settings"]',
    navProfile: '[data-cy="sidebar-nav-profile"]',
    
    // Estados del sidebar
    expanded: '[data-cy="sidebar-main"].expanded',
    collapsed: '[data-cy="sidebar-main"].collapsed',
    
    // Elementos móviles
    overlay: '[data-cy="sidebar-overlay"]',
    mobileToggle: '[data-cy="mobile-sidebar-toggle"]',
  }

  /**
   * Valida que el sidebar está visible y cargado correctamente
   */
  validateSidebarVisible() {
    cy.get(AppSidebar.selectors.main).should('be.visible')
    cy.get(AppSidebar.selectors.nav).should('be.visible')
    cy.get(AppSidebar.selectors.logo).should('be.visible')
    cy.get(AppSidebar.selectors.toggle).should('be.visible')
    
    return this
  }

  /**
   * Valida que el sidebar está en estado expandido
   */
  validateExpanded() {
    cy.get(AppSidebar.selectors.main)
      .should('be.visible')
      .and('have.css', 'width', '256px') // Ancho típico expandido
    
    // Verificar que los textos de navegación son visibles
    cy.get(AppSidebar.selectors.navItems).within(() => {
      cy.get('span').should('be.visible')
    })
    
    return this
  }

  /**
   * Valida que el sidebar está en estado colapsado
   */
  validateCollapsed() {
    cy.get(AppSidebar.selectors.main)
      .should('be.visible')
      .and('have.css', 'width', '64px') // Ancho típico colapsado
    
    return this
  }

  /**
   * Alterna el estado del sidebar (expandido/colapsado)
   */
  toggle() {
    cy.get(AppSidebar.selectors.toggle).click()
    return this
  }

  /**
   * Expande el sidebar si está colapsado
   */
  expand() {
    cy.get(AppSidebar.selectors.main).then(($sidebar) => {
      if ($sidebar.hasClass('collapsed')) {
        this.toggle()
      }
    })
    return this
  }

  /**
   * Colapsa el sidebar si está expandido
   */
  collapse() {
    cy.get(AppSidebar.selectors.main).then(($sidebar) => {
      if (!$sidebar.hasClass('collapsed')) {
        this.toggle()
      }
    })
    return this
  }

  /**
   * Navega a Dashboard
   */
  navigateToDashboard() {
    cy.get(AppSidebar.selectors.navDashboard).click()
    cy.url().should('include', '/dashboard')
    return this
  }

  /**
   * Navega a Tasks
   */
  navigateToTasks() {
    cy.get(AppSidebar.selectors.navTasks).click()
    cy.url().should('include', '/tasks')
    return this
  }

  /**
   * Navega a Settings
   */
  navigateToSettings() {
    cy.get(AppSidebar.selectors.navSettings).click()
    cy.url().should('include', '/settings')
    return this
  }

  /**
   * Navega a Profile
   */
  navigateToProfile() {
    cy.get(AppSidebar.selectors.navProfile).click()
    cy.url().should('include', '/profile')
    return this
  }

  /**
   * Valida que el item de navegación está activo
   */
  validateActiveNavItem(itemName) {
    cy.get(`[data-cy="sidebar-nav-${itemName.toLowerCase()}"]`)
      .should('have.class', 'active')
      .or('have.attr', 'aria-current', 'page')
    
    return this
  }

  /**
   * Valida elementos de navegación según el rol del usuario
   */
  validateNavigationForRole(userRole) {
    if (userRole === 'member') {
      cy.get(AppSidebar.selectors.navDashboard).should('be.visible')
      cy.get(AppSidebar.selectors.navTasks).should('be.visible')
      // Sector7 no debería estar visible para members
      cy.get('[data-cy="sidebar-nav-sector7"]').should('not.exist')
    }
    
    if (userRole === 'superadmin') {
      cy.get(AppSidebar.selectors.navDashboard).should('be.visible')
      cy.get(AppSidebar.selectors.navTasks).should('be.visible')
      cy.get('[data-cy="sidebar-nav-sector7"]').should('be.visible')
    }
    
    return this
  }

  /**
   * Valida comportamiento responsive en móvil
   */
  validateMobileBehavior() {
    // Simular viewport móvil
    cy.viewport(375, 667)
    
    // El sidebar debería estar oculto inicialmente
    cy.get(AppSidebar.selectors.main).should('not.be.visible')
    
    // El toggle móvil debería estar visible
    cy.get(AppSidebar.selectors.mobileToggle).should('be.visible')
    
    return this
  }

  /**
   * Abre sidebar en móvil
   */
  openMobileSidebar() {
    cy.get(AppSidebar.selectors.mobileToggle).click()
    cy.get(AppSidebar.selectors.main).should('be.visible')
    cy.get(AppSidebar.selectors.overlay).should('be.visible')
    
    return this
  }

  /**
   * Cierra sidebar en móvil clickeando overlay
   */
  closeMobileSidebarWithOverlay() {
    cy.get(AppSidebar.selectors.overlay).click()
    cy.get(AppSidebar.selectors.main).should('not.be.visible')
    
    return this
  }

  /**
   * Valida accesibilidad del sidebar
   */
  validateAccessibility() {
    // Verificar ARIA labels
    cy.get(AppSidebar.selectors.main)
      .should('have.attr', 'role', 'navigation')
      .or('have.attr', 'aria-label')
    
    // Verificar navegación por teclado
    cy.get(AppSidebar.selectors.toggle).focus()
    cy.get(AppSidebar.selectors.toggle).should('be.focused')
    
    // Tab navigation
    cy.tab()
    cy.get(AppSidebar.selectors.navItems).within(() => {
      cy.focused().should('exist')
    })
    
    return this
  }

  /**
   * Valida tooltips cuando el sidebar está colapsado
   */
  validateTooltips() {
    this.collapse()
    
    // Hover sobre elementos de navegación debería mostrar tooltips
    cy.get(AppSidebar.selectors.navDashboard).trigger('mouseover')
    cy.get('[role="tooltip"]').should('be.visible')
    
    return this
  }

  /**
   * Valida animaciones de transición
   */
  validateTransitions() {
    // Verificar que hay transiciones CSS
    cy.get(AppSidebar.selectors.main)
      .should('have.css', 'transition-property')
      .and('not.equal', 'none')
    
    return this
  }

  /**
   * Valida logo y branding
   */
  validateLogo() {
    cy.get(AppSidebar.selectors.logo)
      .should('be.visible')
      .and('have.attr', 'alt')
    
    // Verificar que el logo es clickeable y navega al dashboard
    cy.get(AppSidebar.selectors.logo).click()
    cy.url().should('include', '/dashboard')
    
    return this
  }

  /**
   * Valida que se mantiene el estado entre navegaciones
   */
  validateStatePersis() {
    // Colapsar sidebar
    this.collapse()
    this.validateCollapsed()
    
    // Navegar a otra página
    this.navigateToTasks()
    
    // Verificar que el estado se mantiene
    this.validateCollapsed()
    
    return this
  }

  /**
   * Valida elementos de sidebar según el contexto
   */
  validateContextualElements(currentPage) {
    switch (currentPage) {
      case 'dashboard':
        this.validateActiveNavItem('dashboard')
        break
      case 'tasks':
        this.validateActiveNavItem('tasks')
        break
      case 'settings':
        this.validateActiveNavItem('settings')
        break
      default:
        cy.log(`No specific validation for ${currentPage}`)
    }
    
    return this
  }

  // ========================================
  // MÉTODOS REQUERIDOS POR LOS TESTS
  // ========================================

  /**
   * Valida la estructura general del sidebar
   */
  validateSidebarStructure() {
    cy.get(AppSidebar.selectors.main).should('be.visible')
    cy.get(AppSidebar.selectors.nav).should('be.visible')
    cy.get(AppSidebar.selectors.headerSection).should('be.visible')
    cy.get(AppSidebar.selectors.navItems).should('be.visible')
    return this
  }

  /**
   * Valida que existen los elementos de navegación principales
   */
  validateNavigationItems() {
    cy.get(AppSidebar.selectors.navDashboard).should('be.visible')
    cy.get(AppSidebar.selectors.navTasks).should('be.visible')
    cy.get(AppSidebar.selectors.navSettings).should('be.visible')
    return this
  }

  /**
   * Valida la sección de usuario en el sidebar
   */
  validateUserSection() {
    cy.get(AppSidebar.selectors.navProfile).should('be.visible')
    return this
  }

  /**
   * Valida que existe el botón de colapsar/expandir
   */
  validateCollapseButton() {
    cy.get(AppSidebar.selectors.toggle).should('be.visible')
    return this
  }

  /**
   * Navega al dashboard
   */
  navigateToDashboard() {
    cy.get(AppSidebar.selectors.navDashboard).click()
    cy.url().should('include', '/dashboard')
    return this
  }

  /**
   * Navega a la página de tasks
   */
  navigateToTasks() {
    cy.get(AppSidebar.selectors.navTasks).click()
    cy.url().should('include', '/tasks')
    return this
  }

  /**
   * Navega a settings
   */
  navigateToSettings() {
    cy.get(AppSidebar.selectors.navSettings).click()
    cy.url().should('include', '/settings')
    return this
  }

  /**
   * Navega al perfil
   */
  navigateToProfile() {
    cy.get(AppSidebar.selectors.navProfile).click()
    cy.url().should('include', '/profile')
    return this
  }

  /**
   * Valida que un item de navegación está activo
   */
  validateActiveNavItem(itemName) {
    const selector = AppSidebar.selectors[`nav${itemName.charAt(0).toUpperCase() + itemName.slice(1)}`]
    if (selector) {
      cy.get(selector).should('have.class', 'active').or('have.attr', 'aria-current')
    }
    return this
  }

  /**
   * Colapsa el sidebar
   */
  collapseSidebar() {
    cy.get(AppSidebar.selectors.toggle).click()
    cy.get(AppSidebar.selectors.main).should('have.class', 'collapsed')
    return this
  }

  /**
   * Expande el sidebar
   */
  expandSidebar() {
    cy.get(AppSidebar.selectors.toggle).click()
    cy.get(AppSidebar.selectors.main).should('have.class', 'expanded').or('not.have.class', 'collapsed')
    return this
  }

  /**
   * Valida estado colapsado
   */
  validateCollapsedState() {
    cy.get(AppSidebar.selectors.main).should('have.class', 'collapsed')
    return this
  }

  /**
   * Valida estado expandido
   */
  validateExpandedState() {
    cy.get(AppSidebar.selectors.main).should('have.class', 'expanded').or('not.have.class', 'collapsed')
    return this
  }

  /**
   * Verifica el comportamiento en móvil
   */
  validateMobileBehavior() {
    cy.viewport('iphone-6')
    cy.get(AppSidebar.selectors.mobileToggle).should('be.visible')
    return this
  }

  /**
   * Abre el sidebar en móvil
   */
  openMobileSidebar() {
    cy.get(AppSidebar.selectors.mobileToggle).click()
    cy.get(AppSidebar.selectors.overlay).should('be.visible')
    return this
  }

  /**
   * Cierra el sidebar en móvil
   */
  closeMobileSidebar() {
    cy.get(AppSidebar.selectors.overlay).click()
    cy.get(AppSidebar.selectors.overlay).should('not.be.visible')
    return this
  }
}
