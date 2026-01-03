/**
 * Sector7Navigation - Page Object Model Class
 * 
 * Encapsula funcionalidad específica de navegación en el área Sector7
 * Mapea test cases: SEC7_021-028 de sector7-nav.cy.md
 */
export class Sector7Navigation {
  static selectors = {
    // Navegación principal de Sector7
    sector7Nav: '[data-cy="sector7-nav"]',
    sector7Layout: '[data-cy="sector7-layout"]',
    sector7Sidebar: '[data-cy="sector7-sidebar"]',
    
    // Links de navegación principales
    navDashboard: '[data-cy="sector7-nav-dashboard"]',
    navUsers: '[data-cy="sector7-nav-users"]',
    navTeams: '[data-cy="sector7-nav-teams"]',
    navStyle: '[data-cy="sector7-nav-style-gallery"]',
    navAnalytics: '[data-cy="sector7-nav-analytics"]',
    navConfig: '[data-cy="sector7-nav-system-config"]',
    
    // Estados activos
    activeNavItem: '.active',
    currentNavItem: '[aria-current="page"]',
    
    // Header y breadcrumb de Sector7
    sector7Header: '[data-cy="sector7-header"]',
    breadcrumb: '[data-cy="sector7-breadcrumb"]',
    backToMainApp: '[data-cy="back-to-main-app"]',
    
    // Quick access desde TopNavbar
    topnavSector7: '[data-cy="topnav-sector7"]',
    
    // Elementos de navegación específicos del layout
    sidebarToggle: '[data-cy="sector7-sidebar-toggle"]',
    sidebarCollapsed: '[data-cy="sector7-sidebar"].collapsed',
    sidebarExpanded: '[data-cy="sector7-sidebar"].expanded',
    
    // Elementos de acceso rápido
    quickActions: '[data-cy="sector7-quick-actions"]',
    quickActionDashboard: '[data-cy="quick-dashboard"]',
    quickActionUsers: '[data-cy="quick-users"]',
    quickActionStyle: '[data-cy="quick-style"]',
    
    // Indicadores y badges
    navItemIcon: '.nav-icon',
    navItemText: '.nav-text',
    navItemBadge: '.nav-badge',
    userCount: '[data-cy="users-count-badge"]',
    
    // Estados de funcionalidades
    enabledFeature: ':not(.opacity-50)',
    disabledFeature: '.opacity-50',
    comingSoon: '.coming-soon',
    
    // Mobile navigation
    mobileMenuToggle: '[data-cy="mobile-sector7-toggle"]',
    mobileNav: '[data-cy="mobile-sector7-nav"]',
    
    // Notificaciones y alerts específicos de admin
    adminNotifications: '[data-cy="admin-notifications"]',
    systemAlerts: '[data-cy="system-alerts"]',
    maintenanceMode: '[data-cy="maintenance-mode"]',
  }

  /**
   * Accede a Sector7 desde el dashboard principal
   */
  accessSector7FromMainApp() {
    cy.get(Sector7Navigation.selectors.topnavSector7).click()
    cy.url().should('include', '/sector7')
    
    return this
  }

  /**
   * Valida que la navegación de Sector7 está cargada
   */
  validateSector7NavigationLoaded() {
    cy.get(Sector7Navigation.selectors.sector7Layout).should('be.visible')
    cy.get(Sector7Navigation.selectors.sector7Header).should('be.visible')
    cy.url().should('include', '/sector7')
    
    return this
  }

  /**
   * Navega al dashboard de Sector7
   */
  navigateToDashboard() {
    cy.get(Sector7Navigation.selectors.navDashboard).click()
    cy.url().should('match', /\/sector7\/?$/)
    
    return this
  }

  /**
   * Navega a gestión de usuarios
   */
  navigateToUsers() {
    cy.get(Sector7Navigation.selectors.navUsers).click()
    cy.url().should('include', '/sector7/users')
    
    return this
  }

  /**
   * Navega a gestión de teams
   */
  navigateToTeams() {
    cy.get(Sector7Navigation.selectors.navTeams).click()
    cy.url().should('include', '/sector7/teams')

    return this
  }

  /**
   * Navega a galería de estilos
   */
  navigateToStyle() {
    cy.get(Sector7Navigation.selectors.navStyle).click()
    cy.url().should('include', '/sector7/style')

    return this
  }

  /**
   * Intenta navegar a analytics (puede estar deshabilitado)
   */
  attemptNavigateToAnalytics() {
    cy.get(Sector7Navigation.selectors.navAnalytics).then(($analytics) => {
      if ($analytics.length > 0) {
        if ($analytics.hasClass('opacity-50')) {
          // Está deshabilitado
          cy.wrap($analytics).should('have.class', 'opacity-50')
          cy.wrap($analytics).click({ force: true }) // Intentar click
          // No debería navegar
          cy.url().should('not.include', '/analytics')
        } else {
          // Está habilitado
          cy.wrap($analytics).click()
          cy.url().should('include', '/sector7/analytics')
        }
      }
    })
    
    return this
  }

  /**
   * Intenta navegar a configuración (puede estar deshabilitado)
   */
  attemptNavigateToConfig() {
    cy.get(Sector7Navigation.selectors.navConfig).then(($config) => {
      if ($config.length > 0) {
        if ($config.hasClass('opacity-50')) {
          // Está deshabilitado
          cy.wrap($config).should('have.class', 'opacity-50')
        } else {
          // Está habilitado
          cy.wrap($config).click()
          cy.url().should('include', '/sector7/config')
        }
      }
    })
    
    return this
  }

  /**
   * Valida el item de navegación activo
   */
  validateActiveNavItem(expectedSection) {
    const navSelectors = {
      dashboard: Sector7Navigation.selectors.navDashboard,
      users: Sector7Navigation.selectors.navUsers,
      style: Sector7Navigation.selectors.navStyle,
      analytics: Sector7Navigation.selectors.navAnalytics,
      config: Sector7Navigation.selectors.navConfig
    }
    
    if (navSelectors[expectedSection]) {
      cy.get(navSelectors[expectedSection])
        .should('have.class', 'active')
        .or('have.attr', 'aria-current', 'page')
    }
    
    return this
  }

  /**
   * Valida estructura completa de navegación
   */
  validateNavigationStructure() {
    // Verificar elementos principales
    cy.get(Sector7Navigation.selectors.sector7Header).should('be.visible')
    cy.get(Sector7Navigation.selectors.navDashboard).should('be.visible')
    cy.get(Sector7Navigation.selectors.navUsers).should('be.visible')
    cy.get(Sector7Navigation.selectors.navStyle).should('be.visible')
    
    // Analytics y Config pueden estar deshabilitados
    cy.get(Sector7Navigation.selectors.navAnalytics).should('exist')
    cy.get(Sector7Navigation.selectors.navConfig).should('exist')
    
    return this
  }

  /**
   * Valida secuencia completa de navegación
   */
  validateFullNavigationSequence() {
    // Navegar por todas las secciones habilitadas
    this.navigateToDashboard()
    this.validateActiveNavItem('dashboard')
    
    this.navigateToUsers()
    this.validateActiveNavItem('users')
    
    this.navigateToStyle()
    this.validateActiveNavItem('style')
    
    // Volver al dashboard
    this.navigateToDashboard()
    this.validateActiveNavItem('dashboard')
    
    return this
  }

  /**
   * Navega de vuelta a la aplicación principal
   */
  navigateBackToMainApp() {
    cy.get(Sector7Navigation.selectors.backToMainApp).click()
    cy.url().should('include', '/dashboard')
    cy.url().should('not.include', '/sector7')
    
    return this
  }

  /**
   * Valida quick actions de navegación
   */
  validateQuickActions() {
    cy.get(Sector7Navigation.selectors.quickActions).then(($quick) => {
      if ($quick.length > 0) {
        cy.wrap($quick).should('be.visible')
        cy.get(Sector7Navigation.selectors.quickActionDashboard).should('be.visible')
        cy.get(Sector7Navigation.selectors.quickActionUsers).should('be.visible')
        cy.get(Sector7Navigation.selectors.quickActionStyle).should('be.visible')
      }
    })
    
    return this
  }

  /**
   * Usa quick action para navegar
   */
  useQuickAction(action) {
    const quickSelectors = {
      dashboard: Sector7Navigation.selectors.quickActionDashboard,
      users: Sector7Navigation.selectors.quickActionUsers,
      style: Sector7Navigation.selectors.quickActionStyle
    }
    
    if (quickSelectors[action]) {
      cy.get(quickSelectors[action]).click()
      
      if (action === 'dashboard') {
        cy.url().should('match', /\/sector7\/?$/)
      } else {
        cy.url().should('include', `/sector7/${action}`)
      }
    }
    
    return this
  }

  /**
   * Valida acceso solo para superadmin
   */
  validateSuperAdminAccess() {
    // Verificar que la navegación carga correctamente para superadmin
    this.validateSector7NavigationLoaded()
    this.validateNavigationStructure()
    
    // Verificar elementos específicos de superadmin
    cy.get(Sector7Navigation.selectors.navUsers).should('be.visible')
    cy.get(Sector7Navigation.selectors.navStyle).should('be.visible')
    
    return this
  }

  /**
   * Valida que usuario normal no puede acceder
   */
  validateMemberAccessDenied() {
    // Debería redirigir o mostrar error de acceso
    cy.url().should('not.include', '/sector7')
      .or('contain', '/403')
      .or('contain', '/login')
    
    return this
  }

  /**
   * Valida breadcrumb de Sector7
   */
  validateBreadcrumb(currentSection = null) {
    cy.get(Sector7Navigation.selectors.breadcrumb).should('be.visible')
    cy.get(Sector7Navigation.selectors.breadcrumb).should('contain.text', 'Sector7')
    
    if (currentSection) {
      cy.get(Sector7Navigation.selectors.breadcrumb)
        .should('contain.text', currentSection)
    }
    
    return this
  }

  /**
   * Valida badges y contadores
   */
  validateNavigationBadges() {
    cy.get(Sector7Navigation.selectors.userCount).then(($count) => {
      if ($count.length > 0) {
        cy.wrap($count).should('be.visible')
        cy.wrap($count).should('not.be.empty')
      }
    })
    
    cy.get(Sector7Navigation.selectors.navItemBadge).then(($badges) => {
      if ($badges.length > 0) {
        cy.wrap($badges).should('be.visible')
      }
    })
    
    return this
  }

  /**
   * Valida iconos de navegación
   */
  validateNavigationIcons() {
    cy.get(Sector7Navigation.selectors.navItemIcon).should('have.length.at.least', 3)
    
    return this
  }

  /**
   * Valida texto de navegación
   */
  validateNavigationText() {
    cy.get(Sector7Navigation.selectors.navDashboard).should('contain.text', 'Dashboard')
    cy.get(Sector7Navigation.selectors.navUsers).should('contain.text', 'Users')
    cy.get(Sector7Navigation.selectors.navStyle).should('contain.text', 'Style')
    
    return this
  }

  /**
   * Valida estados de funcionalidades
   */
  validateFeatureStates() {
    // Funcionalidades habilitadas
    cy.get(Sector7Navigation.selectors.navDashboard).should('not.have.class', 'opacity-50')
    cy.get(Sector7Navigation.selectors.navUsers).should('not.have.class', 'opacity-50')
    cy.get(Sector7Navigation.selectors.navStyle).should('not.have.class', 'opacity-50')
    
    // Funcionalidades que pueden estar deshabilitadas
    cy.get(Sector7Navigation.selectors.navAnalytics).should('have.class', 'opacity-50')
    cy.get(Sector7Navigation.selectors.navConfig).should('have.class', 'opacity-50')
    
    return this
  }

  /**
   * Valida notificaciones de admin
   */
  validateAdminNotifications() {
    cy.get(Sector7Navigation.selectors.adminNotifications).then(($notifications) => {
      if ($notifications.length > 0) {
        cy.wrap($notifications).should('be.visible')
      }
    })
    
    cy.get(Sector7Navigation.selectors.systemAlerts).then(($alerts) => {
      if ($alerts.length > 0) {
        cy.wrap($alerts).should('be.visible')
      }
    })
    
    return this
  }

  /**
   * Valida modo de mantenimiento
   */
  validateMaintenanceMode() {
    cy.get(Sector7Navigation.selectors.maintenanceMode).then(($maintenance) => {
      if ($maintenance.length > 0) {
        cy.wrap($maintenance).should('be.visible')
        cy.wrap($maintenance).should('contain.text', 'Maintenance')
      }
    })
    
    return this
  }

  /**
   * Valida comportamiento responsive
   */
  validateResponsiveBehavior() {
    // Desktop: navegación completa visible
    cy.viewport(1200, 800)
    this.validateNavigationStructure()
    
    // Mobile: menú colapsado
    cy.viewport(375, 667)
    cy.get(Sector7Navigation.selectors.mobileMenuToggle).then(($toggle) => {
      if ($toggle.length > 0) {
        cy.wrap($toggle).should('be.visible')
        cy.wrap($toggle).click()
        cy.get(Sector7Navigation.selectors.mobileNav).should('be.visible')
      }
    })
    
    return this
  }

  /**
   * Valida navegación por URL directa
   */
  validateDirectURLNavigation(section) {
    const sectionUrls = {
      dashboard: '/sector7',
      users: '/sector7/users',
      style: '/sector7/style'
    }
    
    if (sectionUrls[section]) {
      cy.visit(sectionUrls[section])
      cy.url().should('include', sectionUrls[section])
      this.validateActiveNavItem(section)
    }
    
    return this
  }

  /**
   * Valida accesibilidad
   */
  validateAccessibility() {
    // Verificar roles ARIA
    cy.get(Sector7Navigation.selectors.sector7Nav)
      .should('have.attr', 'role', 'navigation')
      .or('have.attr', 'aria-label')
    
    // Navegación por teclado
    cy.get(Sector7Navigation.selectors.navDashboard).focus()
    cy.tab()
    cy.get(Sector7Navigation.selectors.navUsers).should('be.focused')
    
    // Enter para navegar
    cy.get(Sector7Navigation.selectors.navStyle).focus()
    cy.get(Sector7Navigation.selectors.navStyle).type('{enter}')
    cy.url().should('include', '/sector7/style')
    
    return this
  }

  /**
   * Valida persistencia de navegación
   */
  validateNavigationPersistence() {
    // Navegar a una sección
    this.navigateToUsers()
    this.validateActiveNavItem('users')
    
    // Recargar página
    cy.reload()
    
    // Verificar que mantiene estado activo
    this.validateActiveNavItem('users')
    
    return this
  }

  /**
   * Valida integración con TopNavbar
   */
  validateTopNavbarIntegration() {
    // Verificar que el enlace de Sector7 en topnav funciona
    cy.visit('/dashboard')
    cy.get(Sector7Navigation.selectors.topnavSector7).should('be.visible')
    
    this.accessSector7FromMainApp()
    this.validateSector7NavigationLoaded()
    
    return this
  }

  /**
   * Valida transiciones suaves entre secciones
   */
  validateSmoothTransitions() {
    // Verificar transiciones sin romper estado
    this.navigateToDashboard()
    cy.get('[data-cy="sector7-dashboard"]').should('be.visible')
    
    this.navigateToUsers()
    cy.get('[data-cy="users-table"]').should('be.visible')
    
    this.navigateToStyle()
    cy.get('[data-cy="style-gallery-container"]').should('be.visible')
    
    return this
  }
}
