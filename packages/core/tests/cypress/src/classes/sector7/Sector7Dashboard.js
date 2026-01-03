/**
 * Sector7Dashboard - Page Object Model Class
 * 
 * Encapsula funcionalidad del dashboard de administración Sector7
 * Mapea test cases: SEC7_001-008 de sector7-dashboard.cy.md
 */
export class Sector7Dashboard {
  static selectors = {
    // Contenedores principales (usando selectores genéricos hasta implementar data-cy)
    container: '.space-y-6',
    header: 'h1:contains("Sector7 Admin")',
    
    // Cards de quick actions
    quickActionsGrid: '.grid.gap-4',
    quickActionCard: '.rounded-lg.border.p-6',
    
    // Acciones específicas de navegación
    userManagementCard: 'a[href="/sector7/users"]',
    styleGalleryCard: 'a[href="/sector7/style"]',
    analyticsCard: '.text-green-600',
    systemConfigCard: '.text-orange-600',
    
    // Elementos dentro de las cards
    cardTitle: 'h3',
    cardDescription: 'p.text-sm',
    cardIcon: 'svg',
    
    // Estados de las cards
    enabledCard: ':not(.opacity-50)',
    disabledCard: '.opacity-50',
    
    // Navegación y breadcrumbs
    breadcrumb: '[data-cy="breadcrumb"]',
    backButton: 'button:contains("Back")',
    
    // Estados de la página
    loadingState: '.animate-pulse',
    errorState: '.text-destructive',
    
    // Estadísticas del sistema (si están implementadas)
    statsSection: '[data-cy="system-stats"]',
    activeUsersCount: '[data-cy="active-users-count"]',
    totalUsersCount: '[data-cy="total-users-count"]',
    systemHealth: '[data-cy="system-health"]',
  }

  /**
   * Valida que el dashboard de Sector7 está cargado
   */
  validateSector7DashboardLoaded() {
    cy.get(Sector7Dashboard.selectors.container).should('be.visible')
    cy.get(Sector7Dashboard.selectors.header).should('be.visible')
    cy.get(Sector7Dashboard.selectors.quickActionsGrid).should('be.visible')
    cy.url().should('include', '/sector7')
    
    return this
  }

  /**
   * Valida acceso solo para superadmin
   */
  validateSuperAdminAccess() {
    // Verificar que la página carga correctamente para superadmin
    this.validateSector7DashboardLoaded()
    
    // Verificar presencia de elementos exclusivos para superadmin
    cy.get(Sector7Dashboard.selectors.userManagementCard).should('be.visible')
    cy.get(Sector7Dashboard.selectors.styleGalleryCard).should('be.visible')
    
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
   * Navega a gestión de usuarios
   */
  navigateToUserManagement() {
    cy.get(Sector7Dashboard.selectors.userManagementCard).click()
    cy.url().should('include', '/sector7/users')
    
    return this
  }

  /**
   * Navega a galería de estilos
   */
  navigateToStyleGallery() {
    cy.get(Sector7Dashboard.selectors.styleGalleryCard).click()
    cy.url().should('include', '/sector7/style')
    
    return this
  }

  /**
   * Intenta navegar a analytics (deshabilitado)
   */
  attemptNavigateToAnalytics() {
    cy.get(Sector7Dashboard.selectors.analyticsCard).parent()
      .should('have.class', 'opacity-50')
      .and('have.class', 'cursor-not-allowed')
    
    return this
  }

  /**
   * Intenta navegar a configuración del sistema (deshabilitado)
   */
  attemptNavigateToSystemConfig() {
    cy.get(Sector7Dashboard.selectors.systemConfigCard).parent()
      .should('have.class', 'opacity-50')
      .and('have.class', 'cursor-not-allowed')
    
    return this
  }

  /**
   * Valida estructura de las quick actions
   */
  validateQuickActionsStructure() {
    cy.get(Sector7Dashboard.selectors.quickActionCard).should('have.length', 4)
    
    // Verificar estructura de cada card
    cy.get(Sector7Dashboard.selectors.quickActionCard).each(($card) => {
      cy.wrap($card).within(() => {
        cy.get(Sector7Dashboard.selectors.cardIcon).should('be.visible')
        cy.get(Sector7Dashboard.selectors.cardTitle).should('be.visible')
        cy.get(Sector7Dashboard.selectors.cardDescription).should('be.visible')
      })
    })
    
    return this
  }

  /**
   * Valida contenido específico de cada quick action
   */
  validateQuickActionsContent() {
    // User Management
    cy.get(Sector7Dashboard.selectors.userManagementCard).within(() => {
      cy.contains('User Management').should('be.visible')
      cy.contains('View and manage all users').should('be.visible')
    })
    
    // Style Gallery
    cy.get(Sector7Dashboard.selectors.styleGalleryCard).within(() => {
      cy.contains('Style Gallery').should('be.visible')
      cy.contains('Preview components').should('be.visible')
    })
    
    return this
  }

  /**
   * Valida estados habilitados y deshabilitados
   */
  validateActionStates() {
    // Acciones habilitadas
    cy.get(Sector7Dashboard.selectors.userManagementCard)
      .should('not.have.class', 'opacity-50')
    
    cy.get(Sector7Dashboard.selectors.styleGalleryCard)
      .should('not.have.class', 'opacity-50')
    
    // Acciones deshabilitadas
    cy.get(Sector7Dashboard.selectors.analyticsCard).parent()
      .should('have.class', 'opacity-50')
    
    cy.get(Sector7Dashboard.selectors.systemConfigCard).parent()
      .should('have.class', 'opacity-50')
    
    return this
  }

  /**
   * Valida iconos de las quick actions
   */
  validateActionIcons() {
    cy.get(Sector7Dashboard.selectors.quickActionCard).each(($card) => {
      cy.wrap($card).within(() => {
        cy.get(Sector7Dashboard.selectors.cardIcon)
          .should('be.visible')
          .and('have.attr', 'viewBox') // SVG attribute
      })
    })
    
    return this
  }

  /**
   * Valida efectos hover en las cards
   */
  validateHoverEffects() {
    cy.get(Sector7Dashboard.selectors.userManagementCard)
      .trigger('mouseover')
      .should('have.css', 'transform')
      .or('have.css', 'box-shadow')
    
    return this
  }

  /**
   * Valida breadcrumb navigation
   */
  validateBreadcrumb() {
    cy.get(Sector7Dashboard.selectors.breadcrumb).then(($breadcrumb) => {
      if ($breadcrumb.length > 0) {
        cy.wrap($breadcrumb).should('be.visible')
        cy.wrap($breadcrumb).should('contain.text', 'Sector7')
      }
    })
    
    return this
  }

  /**
   * Valida estadísticas del sistema si están disponibles
   */
  validateSystemStats() {
    cy.get(Sector7Dashboard.selectors.statsSection).then(($stats) => {
      if ($stats.length > 0) {
        cy.wrap($stats).should('be.visible')
        
        cy.get(Sector7Dashboard.selectors.activeUsersCount)
          .should('be.visible')
          .and('not.be.empty')
        
        cy.get(Sector7Dashboard.selectors.totalUsersCount)
          .should('be.visible')
          .and('not.be.empty')
      }
    })
    
    return this
  }

  /**
   * Valida salud del sistema
   */
  validateSystemHealth() {
    cy.get(Sector7Dashboard.selectors.systemHealth).then(($health) => {
      if ($health.length > 0) {
        cy.wrap($health).should('be.visible')
        cy.wrap($health).should('contain.text', 'Healthy')
          .or('contain.text', 'Warning')
          .or('contain.text', 'Critical')
      }
    })
    
    return this
  }

  /**
   * Valida estado de carga
   */
  validateLoadingState() {
    cy.get(Sector7Dashboard.selectors.loadingState).should('be.visible')
    
    return this
  }

  /**
   * Valida que terminó de cargar
   */
  validateLoadingCompleted() {
    cy.get(Sector7Dashboard.selectors.loadingState).should('not.exist')
    
    return this
  }

  /**
   * Valida estado de error
   */
  validateErrorState() {
    cy.get(Sector7Dashboard.selectors.errorState).should('be.visible')
    
    return this
  }

  /**
   * Valida comportamiento responsive
   */
  validateResponsiveBehavior() {
    // Desktop: grid de 2 columnas
    cy.viewport(1200, 800)
    cy.get(Sector7Dashboard.selectors.quickActionsGrid)
      .should('have.css', 'grid-template-columns')
    
    // Mobile: columna única
    cy.viewport(375, 667)
    cy.get(Sector7Dashboard.selectors.quickActionsGrid).should('be.visible')
    
    return this
  }

  /**
   * Valida accesibilidad del dashboard
   */
  validateAccessibility() {
    // Verificar estructura de headings
    cy.get('h1').should('exist')
    
    // Verificar que las cards tienen roles apropiados
    cy.get(Sector7Dashboard.selectors.quickActionCard).each(($card) => {
      cy.wrap($card).should('have.attr', 'role')
        .or('have.attr', 'aria-label')
    })
    
    // Navegación por teclado
    cy.get(Sector7Dashboard.selectors.userManagementCard).focus()
    cy.tab()
    cy.focused().should('exist')
    
    return this
  }

  /**
   * Valida integración con navegación principal
   */
  validateNavigationIntegration() {
    // Verificar que sidebar y topnav están presentes
    cy.get('[data-cy="sidebar-main"]').should('be.visible')
    cy.get('[data-cy="topnav-header"]').should('be.visible')
    
    // Verificar enlace a Sector7 en topnav
    cy.get('[data-cy="topnav-sector7"]').should('be.visible')
    
    return this
  }

  /**
   * Valida permisos específicos de superadmin
   */
  validateSuperAdminPermissions() {
    // Verificar que todas las acciones permitidas están visibles
    cy.get(Sector7Dashboard.selectors.userManagementCard).should('be.visible')
    cy.get(Sector7Dashboard.selectors.styleGalleryCard).should('be.visible')
    
    // Verificar que no hay elementos de usuario normal
    cy.get('[data-cy="member-only"]').should('not.exist')
    
    return this
  }

  /**
   * Valida tiempo de carga del dashboard
   */
  validatePerformance() {
    // El dashboard debería cargar rápidamente
    cy.get(Sector7Dashboard.selectors.container, { timeout: 3000 })
      .should('be.visible')
    
    return this
  }

  /**
   * Valida colores y tema de Sector7
   */
  validateSector7Theme() {
    // Verificar colores específicos de Sector7
    cy.get(Sector7Dashboard.selectors.userManagementCard).within(() => {
      cy.get('.text-blue-600').should('exist')
    })
    
    cy.get(Sector7Dashboard.selectors.styleGalleryCard).within(() => {
      cy.get('.text-purple-600').should('exist')
    })
    
    return this
  }

  /**
   * Valida integración con sistema de autenticación
   */
  validateAuthIntegration() {
    // Verificar que el usuario está autenticado como superadmin
    cy.window().its('localStorage').then((localStorage) => {
      expect(localStorage.getItem('session')).to.exist
    })
    
    return this
  }

  // ========================================
  // MÉTODOS REQUERIDOS POR LOS TESTS
  // ========================================

  /**
   * Valida acceso limitado de admin
   */
  validateLimitedAdminAccess() {
    cy.get(Sector7Dashboard.selectors.errorState).should('be.visible')
      .and('contain.text', 'Limited access')
    cy.get(Sector7Dashboard.selectors.disabledCard).should('exist')
    return this
  }

  /**
   * Valida error en dashboard
   */
  validateDashboardError() {
    cy.get(Sector7Dashboard.selectors.errorState).should('be.visible')
      .and('contain.text', 'Error loading dashboard')
    return this
  }

  /**
   * Valida error de red
   */
  validateNetworkError() {
    cy.get(Sector7Dashboard.selectors.errorState).should('be.visible')
      .and('contain.text', 'Network error')
    return this
  }

  // ========================================
  // MISSING METHODS FROM TESTS - PHASE 1
  // ========================================

  /**
   * Valida estructura del dashboard
   */
  validateDashboardStructure() {
    cy.get(Sector7Dashboard.selectors.container).should('be.visible')
    cy.get(Sector7Dashboard.selectors.quickActionsGrid).should('be.visible')
    return this
  }

  /**
   * Valida sección de header
   */
  validateHeaderSection() {
    cy.get(Sector7Dashboard.selectors.header).should('be.visible')
    return this
  }

  /**
   * Valida sección de estadísticas
   */
  validateStatsSection() {
    cy.get(Sector7Dashboard.selectors.statsSection).then(($stats) => {
      if ($stats.length > 0) {
        cy.wrap($stats).should('be.visible')
      }
    })
    return this
  }

  /**
   * Valida estadísticas de usuarios
   */
  validateUserStats() {
    cy.get('[data-cy="user-stats"]').then(($userStats) => {
      if ($userStats.length > 0) {
        cy.wrap($userStats).should('be.visible')
      }
    })
    return this
  }

  /**
   * Valida métricas de rendimiento
   */
  validatePerformanceMetrics() {
    cy.get('[data-cy="performance-metrics"]').then(($metrics) => {
      if ($metrics.length > 0) {
        cy.wrap($metrics).should('be.visible')
      }
    })
    return this
  }

  /**
   * Valida métricas de seguridad
   */
  validateSecurityMetrics() {
    cy.get('[data-cy="security-metrics"]').then(($metrics) => {
      if ($metrics.length > 0) {
        cy.wrap($metrics).should('be.visible')
      }
    })
    return this
  }

  /**
   * Valida acción de gestión de usuarios
   */
  validateUserManagementAction() {
    cy.get(Sector7Dashboard.selectors.userManagementCard).should('be.visible')
    return this
  }

  /**
   * Valida acción de configuración del sistema
   */
  validateSystemSettingsAction() {
    cy.get('[data-cy="system-settings-action"]').then(($action) => {
      if ($action.length > 0) {
        cy.wrap($action).should('be.visible')
      }
    })
    return this
  }

  /**
   * Valida acción de analytics
   */
  validateAnalyticsAction() {
    cy.get(Sector7Dashboard.selectors.analyticsCard).should('be.visible')
    return this
  }

  /**
   * Valida acciones habilitadas
   */
  validateEnabledActions() {
    cy.get(Sector7Dashboard.selectors.userManagementCard)
      .should('not.have.class', 'opacity-50')
    cy.get(Sector7Dashboard.selectors.styleGalleryCard)
      .should('not.have.class', 'opacity-50')
    return this
  }

  /**
   * Valida acciones deshabilitadas
   */
  validateDisabledActions() {
    cy.get(Sector7Dashboard.selectors.analyticsCard).parent()
      .should('have.class', 'opacity-50')
    return this
  }

  /**
   * Valida estado de la base de datos
   */
  validateDatabaseStatus() {
    cy.get('[data-cy="database-status"]').then(($status) => {
      if ($status.length > 0) {
        cy.wrap($status).should('be.visible')
      }
    })
    return this
  }

  /**
   * Valida estado de la API
   */
  validateApiStatus() {
    cy.get('[data-cy="api-status"]').then(($status) => {
      if ($status.length > 0) {
        cy.wrap($status).should('be.visible')
      }
    })
    return this
  }

  /**
   * Valida estado de los servicios
   */
  validateServiceStatus() {
    cy.get('[data-cy="service-status"]').then(($status) => {
      if ($status.length > 0) {
        cy.wrap($status).should('be.visible')
      }
    })
    return this
  }

  /**
   * Valida actividad reciente
   */
  validateRecentActivity() {
    cy.get('[data-cy="recent-activity"]').then(($activity) => {
      if ($activity.length > 0) {
        cy.wrap($activity).should('be.visible')
      }
    })
    return this
  }

  /**
   * Valida log de actividad
   */
  validateActivityLog() {
    cy.get('[data-cy="activity-log"]').then(($log) => {
      if ($log.length > 0) {
        cy.wrap($log).should('be.visible')
      }
    })
    return this
  }

  /**
   * Valida acciones de usuario
   */
  validateUserActions() {
    cy.get('[data-cy="user-actions"]').then(($actions) => {
      if ($actions.length > 0) {
        cy.wrap($actions).should('be.visible')
      }
    })
    return this
  }

  /**
   * Valida eventos del sistema
   */
  validateSystemEvents() {
    cy.get('[data-cy="system-events"]').then(($events) => {
      if ($events.length > 0) {
        cy.wrap($events).should('be.visible')
      }
    })
    return this
  }

  // ========================================
  // ADVANCED FEATURES METHODS
  // ========================================

  /**
   * Valida notificaciones de admin
   */
  validateAdminNotifications() {
    cy.get('[data-cy="admin-notifications"]').then(($notifications) => {
      if ($notifications.length > 0) {
        cy.wrap($notifications).should('be.visible')
      }
    })
    return this
  }

  /**
   * Descarta notificación
   */
  dismissNotification(index) {
    cy.get('[data-cy="dismiss-notification"]').eq(index).click()
    return this
  }

  /**
   * Valida que notificación fue descartada
   */
  validateNotificationDismissed(index) {
    cy.get('[data-cy="admin-notifications"]')
      .children().should('have.length.lessThan', index + 2)
    return this
  }

  /**
   * Habilita modo mantenimiento
   */
  enableMaintenanceMode() {
    cy.get('[data-cy="maintenance-mode-toggle"]').click()
    return this
  }

  /**
   * Valida modo mantenimiento activo
   */
  validateMaintenanceModeActive() {
    cy.get('[data-cy="maintenance-mode-status"]')
      .should('contain.text', 'Active')
    return this
  }

  /**
   * Deshabilita modo mantenimiento
   */
  disableMaintenanceMode() {
    cy.get('[data-cy="maintenance-mode-toggle"]').click()
    return this
  }

  /**
   * Valida modo mantenimiento inactivo
   */
  validateMaintenanceModeInactive() {
    cy.get('[data-cy="maintenance-mode-status"]')
      .should('contain.text', 'Inactive')
    return this
  }

  /**
   * Ve logs de auditoría
   */
  viewAuditLogs() {
    cy.get('[data-cy="audit-logs-button"]').click()
    return this
  }

  /**
   * Valida entradas de log de auditoría
   */
  validateAuditLogEntries() {
    cy.get('[data-cy="audit-log-entries"]').should('be.visible')
    return this
  }

  /**
   * Filtra logs de auditoría
   */
  filterAuditLogs(filterType) {
    cy.get('[data-cy="audit-log-filter"]').select(filterType)
    return this
  }

  /**
   * Valida logs de auditoría filtrados
   */
  validateFilteredAuditLogs() {
    cy.get('[data-cy="filtered-audit-logs"]').should('be.visible')
    return this
  }

  /**
   * Abre configuración del sistema
   */
  openSystemSettings() {
    cy.get('[data-cy="system-settings-button"]').click()
    return this
  }

  /**
   * Actualiza configuración del sistema
   */
  updateSystemSetting(key, value) {
    cy.get(`[data-cy="setting-${key}"]`).clear().type(value)
    return this
  }

  /**
   * Guarda configuración del sistema
   */
  saveSystemSettings() {
    cy.get('[data-cy="save-settings"]').click()
    return this
  }

  /**
   * Valida configuración guardada
   */
  validateSettingsSaved() {
    cy.get('[data-cy="settings-saved"]').should('be.visible')
    return this
  }

  /**
   * Genera reporte de usuarios
   */
  generateUserReport() {
    cy.get('[data-cy="generate-report"]').click()
    return this
  }

  /**
   * Selecciona período de reporte
   */
  selectReportPeriod(period) {
    cy.get('[data-cy="report-period"]').select(period)
    return this
  }

  /**
   * Genera reporte
   */
  generateReport() {
    cy.get('[data-cy="generate-report-button"]').click()
    return this
  }

  /**
   * Valida reporte generado
   */
  validateReportGenerated() {
    cy.get('[data-cy="report-generated"]').should('be.visible')
    return this
  }

  /**
   * Descarga reporte
   */
  downloadReport() {
    cy.get('[data-cy="download-report"]').click()
    return this
  }
}
