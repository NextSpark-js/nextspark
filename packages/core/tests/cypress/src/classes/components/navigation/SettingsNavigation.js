/**
 * SettingsNavigation - Page Object Model Class
 * 
 * Encapsula funcionalidad específica de navegación en configuraciones
 * Mapea test cases: NAV_021-028 de settings-nav.cy.md
 */
export class SettingsNavigation {
  static selectors = {
    // Navegación principal de settings
    settingsNav: '[data-cy="settings-nav"]',
    settingsLayout: '[data-cy="settings-layout-main"]',
    settingsSidebar: '[data-cy="settings-layout-sidebar"]',
    
    // Links de navegación según data-cy encontrados
    navProfile: '[data-cy="settings-sidebar-nav-profile"]',
    navPassword: '[data-cy="settings-sidebar-nav-password"]',
    navSecurity: '[data-cy="settings-sidebar-nav-security"]',
    navBilling: '[data-cy="settings-sidebar-nav-billing"]',
    navNotifications: '[data-cy="settings-sidebar-nav-notifications"]',
    
    // Estados activos
    activeNavItem: '.active',
    currentNavItem: '[aria-current="page"]',
    
    // Sidebar específico de settings
    sidebarMain: '[data-cy="settings-sidebar-main"]',
    sidebarHeader: '[data-cy="settings-sidebar-header"]',
    sidebarNavItems: '[data-cy="settings-sidebar-nav-items"]',
    
    // Overview links (desde page.tsx)
    overviewProfile: '[data-cy="settings-overview-profile"]',
    overviewPassword: '[data-cy="settings-overview-password"]',
    overviewSecurity: '[data-cy="settings-overview-security"]',
    overviewNotifications: '[data-cy="settings-overview-notifications"]',
    overviewBilling: '[data-cy="settings-overview-billing"]',
    
    // Elementos de breadcrumb y navegación superior
    backToDashboard: '[data-cy="settings-layout-back-to-dashboard"]',
    settingsHeader: '[data-cy="settings-layout-header"]',
    
    // Indicadores visuales
    navItemIcon: '.nav-icon',
    navItemText: '.nav-text',
    navItemBadge: '.nav-badge',
    
    // Responsive
    mobileMenuToggle: '[data-cy="mobile-settings-toggle"]',
    mobileNav: '[data-cy="mobile-settings-nav"]',
  }

  /**
   * Valida que la navegación de settings está cargada
   */
  validateSettingsNavigationLoaded() {
    cy.get(SettingsNavigation.selectors.settingsLayout).should('be.visible')
    cy.get(SettingsNavigation.selectors.settingsSidebar).should('be.visible')
    cy.get(SettingsNavigation.selectors.sidebarNavItems).should('be.visible')
    
    return this
  }

  /**
   * Navega a la sección de perfil
   */
  navigateToProfile() {
    cy.get(SettingsNavigation.selectors.navProfile).click()
    cy.url().should('include', '/settings/profile')
    
    return this
  }

  /**
   * Navega a la sección de contraseña
   */
  navigateToPassword() {
    cy.get(SettingsNavigation.selectors.navPassword).click()
    cy.url().should('include', '/settings/password')
    
    return this
  }

  /**
   * Navega a la sección de seguridad
   */
  navigateToSecurity() {
    cy.get(SettingsNavigation.selectors.navSecurity).click()
    cy.url().should('include', '/settings/security')
    
    return this
  }

  /**
   * Navega a la sección de billing
   */
  navigateToBilling() {
    cy.get(SettingsNavigation.selectors.navBilling).click()
    cy.url().should('include', '/settings/billing')
    
    return this
  }

  /**
   * Navega a la sección de notificaciones
   */
  navigateToNotifications() {
    cy.get(SettingsNavigation.selectors.navNotifications).click()
    cy.url().should('include', '/settings/notifications')
    
    return this
  }

  /**
   * Valida el item de navegación activo
   */
  validateActiveNavItem(expectedSection) {
    cy.get(`[data-cy="settings-sidebar-nav-${expectedSection}"]`)
      .should('have.class', 'active')
      .or('have.attr', 'aria-current', 'page')
    
    return this
  }

  /**
   * Valida navegación desde overview
   */
  navigateFromOverview(section) {
    const overviewSelectors = {
      profile: SettingsNavigation.selectors.overviewProfile,
      password: SettingsNavigation.selectors.overviewPassword,
      security: SettingsNavigation.selectors.overviewSecurity,
      notifications: SettingsNavigation.selectors.overviewNotifications,
      billing: SettingsNavigation.selectors.overviewBilling
    }
    
    cy.get(overviewSelectors[section]).click()
    cy.url().should('include', `/settings/${section}`)
    
    return this
  }

  /**
   * Navega de vuelta al dashboard
   */
  navigateBackToDashboard() {
    cy.get(SettingsNavigation.selectors.backToDashboard).click()
    cy.url().should('include', '/dashboard')
    cy.url().should('not.include', '/settings')
    
    return this
  }

  /**
   * Valida estructura completa de navegación
   */
  validateNavigationStructure() {
    // Verificar que todos los elementos principales están presentes
    cy.get(SettingsNavigation.selectors.sidebarMain).should('be.visible')
    cy.get(SettingsNavigation.selectors.sidebarHeader).should('be.visible')
    cy.get(SettingsNavigation.selectors.sidebarNavItems).should('be.visible')
    
    // Verificar que todos los enlaces están presentes
    cy.get(SettingsNavigation.selectors.navProfile).should('be.visible')
    cy.get(SettingsNavigation.selectors.navPassword).should('be.visible')
    cy.get(SettingsNavigation.selectors.navSecurity).should('be.visible')
    cy.get(SettingsNavigation.selectors.navBilling).should('be.visible')
    cy.get(SettingsNavigation.selectors.navNotifications).should('be.visible')
    
    return this
  }

  /**
   * Valida secuencia completa de navegación
   */
  validateFullNavigationSequence() {
    // Navegar por todas las secciones
    this.navigateToProfile()
    this.validateActiveNavItem('profile')
    
    this.navigateToPassword()
    this.validateActiveNavItem('password')
    
    this.navigateToSecurity()
    this.validateActiveNavItem('security')
    
    this.navigateToNotifications()
    this.validateActiveNavItem('notifications')
    
    this.navigateToBilling()
    this.validateActiveNavItem('billing')
    
    return this
  }

  /**
   * Valida navegación por URL directa
   */
  validateDirectURLNavigation(section) {
    cy.visit(`/dashboard/settings/${section}`)
    cy.url().should('include', `/settings/${section}`)
    this.validateActiveNavItem(section)
    
    return this
  }

  /**
   * Valida permisos por rol de usuario
   */
  validateNavigationByRole(userRole) {
    if (userRole === 'member') {
      // Usuarios normales ven todas las opciones básicas
      cy.get(SettingsNavigation.selectors.navProfile).should('be.visible')
      cy.get(SettingsNavigation.selectors.navPassword).should('be.visible')
      cy.get(SettingsNavigation.selectors.navSecurity).should('be.visible')
      cy.get(SettingsNavigation.selectors.navNotifications).should('be.visible')
    }
    
    if (userRole === 'admin' || userRole === 'superadmin') {
      // Admins ven opciones adicionales
      cy.get(SettingsNavigation.selectors.navBilling).should('be.visible')
    }
    
    return this
  }

  /**
   * Valida breadcrumb y header de settings
   */
  validateSettingsHeader() {
    cy.get(SettingsNavigation.selectors.settingsHeader).should('be.visible')
    cy.get(SettingsNavigation.selectors.backToDashboard).should('be.visible')
    
    // Verificar texto del header
    cy.get(SettingsNavigation.selectors.settingsHeader)
      .should('contain.text', 'Settings')
    
    return this
  }

  /**
   * Valida iconos en navegación
   */
  validateNavigationIcons() {
    cy.get(SettingsNavigation.selectors.sidebarNavItems).within(() => {
      cy.get(SettingsNavigation.selectors.navItemIcon).should('have.length.at.least', 4)
    })
    
    return this
  }

  /**
   * Valida texto de navegación
   */
  validateNavigationText() {
    cy.get(SettingsNavigation.selectors.navProfile).should('contain.text', 'Profile')
    cy.get(SettingsNavigation.selectors.navPassword).should('contain.text', 'Password')
    cy.get(SettingsNavigation.selectors.navSecurity).should('contain.text', 'Security')
    cy.get(SettingsNavigation.selectors.navNotifications).should('contain.text', 'Notifications')
    cy.get(SettingsNavigation.selectors.navBilling).should('contain.text', 'Billing')
    
    return this
  }

  /**
   * Valida badges o notificaciones en navegación
   */
  validateNavigationBadges() {
    cy.get(SettingsNavigation.selectors.navItemBadge).then(($badges) => {
      if ($badges.length > 0) {
        cy.wrap($badges).should('be.visible')
      }
    })
    
    return this
  }

  /**
   * Valida comportamiento responsive
   */
  validateResponsiveBehavior() {
    // Desktop: sidebar visible
    cy.viewport(1200, 800)
    cy.get(SettingsNavigation.selectors.settingsSidebar).should('be.visible')
    
    // Mobile: sidebar colapsado, toggle visible
    cy.viewport(375, 667)
    cy.get(SettingsNavigation.selectors.mobileMenuToggle).then(($toggle) => {
      if ($toggle.length > 0) {
        cy.wrap($toggle).should('be.visible')
        cy.wrap($toggle).click()
        cy.get(SettingsNavigation.selectors.mobileNav).should('be.visible')
      }
    })
    
    return this
  }

  /**
   * Valida accesibilidad de navegación
   */
  validateAccessibility() {
    // Verificar roles ARIA
    cy.get(SettingsNavigation.selectors.sidebarNavItems)
      .should('have.attr', 'role', 'navigation')
      .or('have.attr', 'aria-label')
    
    // Verificar navegación por teclado
    cy.get(SettingsNavigation.selectors.navProfile).focus()
    cy.tab()
    cy.get(SettingsNavigation.selectors.navPassword).should('be.focused')
    
    // Verificar Enter para navegar
    cy.get(SettingsNavigation.selectors.navSecurity).focus()
    cy.get(SettingsNavigation.selectors.navSecurity).type('{enter}')
    cy.url().should('include', '/settings/security')
    
    return this
  }

  /**
   * Valida estado de navegación persistente
   */
  validateNavigationStatePersistence() {
    // Navegar a una sección
    this.navigateToSecurity()
    this.validateActiveNavItem('security')
    
    // Recargar página
    cy.reload()
    
    // Verificar que mantiene estado activo
    this.validateActiveNavItem('security')
    
    return this
  }

  /**
   * Valida transiciones entre secciones
   */
  validateSmoothTransitions() {
    // Verificar que las transiciones no rompen el estado
    this.navigateToProfile()
    cy.get('[data-cy="profile-main"]').should('be.visible')
    
    this.navigateToPassword()
    cy.get('[data-cy="password-main"]').should('be.visible')
    
    this.navigateToSecurity()
    cy.get('[data-cy="security-main"]').should('be.visible')
    
    return this
  }

  /**
   * Valida integración con layouts de settings
   */
  validateLayoutIntegration() {
    // Verificar que el layout responde a navegación
    cy.get(SettingsNavigation.selectors.settingsLayout).should('be.visible')
    
    this.navigateToProfile()
    cy.get('[data-cy="settings-layout-page-content"]').within(() => {
      cy.get('[data-cy="profile-main"]').should('be.visible')
    })
    
    return this
  }

  /**
   * Valida prevención de navegación con cambios sin guardar
   */
  validateUnsavedChangesWarning() {
    // Ir a profile y hacer cambios
    this.navigateToProfile()
    cy.get('#firstName').then(($input) => {
      if ($input.length > 0) {
        cy.wrap($input).clear().type('Unsaved Changes')
        
        // Intentar navegar
        this.navigateToPassword()
        
        // Buscar modal de confirmación
        cy.get('[data-cy="unsaved-changes-modal"]').then(($modal) => {
          if ($modal.length > 0) {
            cy.wrap($modal).should('be.visible')
            cy.get('[data-cy="discard-changes"]').click()
          }
        })
      }
    })
    
    return this
  }
}
