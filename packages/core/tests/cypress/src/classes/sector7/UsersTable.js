/**
 * UsersTable - Page Object Model Class
 * 
 * Encapsula funcionalidad de la tabla de gestión de usuarios en Sector7
 * Mapea test cases: SEC7_009-020 de sector7-users.cy.md
 */
export class UsersTable {
  static selectors = {
    // Contenedores principales
    usersPage: '.space-y-6',
    header: 'h1:contains("Users Management")',
    backButton: 'a[href="/sector7"]',
    
    // Tabs de navegación
    tabsList: '[role="tablist"]',
    usersTab: '[data-value="users"]',
    superadminsTab: '[data-value="superadmins"]',
    
    // Estadísticas y contadores
    statsCards: '.grid.gap-4',
    totalUsersCard: '.text-blue-600',
    regularUsersCard: '.text-green-600',
    superadminsCard: '.text-purple-600',
    
    // Tabla de usuarios
    usersTable: 'table',
    tableHeader: 'thead',
    tableBody: 'tbody',
    tableRow: 'tr',
    
    // Columnas de la tabla
    emailColumn: 'td:first-child',
    nameColumn: 'td:nth-child(2)',
    roleColumn: 'td:nth-child(3)',
    statusColumn: 'td:nth-child(4)',
    actionsColumn: 'td:last-child',
    
    // Elementos específicos de filas
    userRow: '[data-user-id]',
    userEmail: '[data-cy="user-email"]',
    userName: '[data-cy="user-name"]',
    userRole: '[data-cy="user-role"]',
    userStatus: '[data-cy="user-status"]',
    
    // Badges y estados
    activeBadge: '.bg-green-100',
    inactiveBadge: '.bg-red-100',
    pendingBadge: '.bg-yellow-100',
    roleBadge: '.rounded-full',
    
    // Acciones de usuario
    userActions: '.flex.gap-2',
    editUserButton: '[data-cy="edit-user"]',
    deleteUserButton: '[data-cy="delete-user"]',
    toggleStatusButton: '[data-cy="toggle-status"]',
    viewUserButton: '[data-cy="view-user"]',
    
    // Estados de la página
    loadingState: '.animate-spin',
    errorState: '.text-destructive',
    emptyState: '.text-muted-foreground:contains("No users")',
    
    // Controles de la tabla
    refreshButton: 'button:contains("Refresh")',
    searchInput: '[data-cy="users-search"]',
    filterSelect: '[data-cy="users-filter"]',
    
    // Paginación
    pagination: '[data-cy="users-pagination"]',
    previousButton: '[data-cy="previous-page"]',
    nextButton: '[data-cy="next-page"]',
    pageInfo: '[data-cy="page-info"]',
    
    // Modales
    deleteModal: '[data-cy="delete-user-modal"]',
    confirmDelete: '[data-cy="confirm-delete-user"]',
    cancelDelete: '[data-cy="cancel-delete-user"]',
    
    // Formulario de creación/edición
    createUserButton: '[data-cy="create-user"]',
    userModal: '[data-cy="user-modal"]',
    userForm: '[data-cy="user-form"]',
  }

  /**
   * Valida que la página de gestión de usuarios está cargada
   */
  validateUsersPageLoaded() {
    cy.get(UsersTable.selectors.usersPage).should('be.visible')
    cy.get(UsersTable.selectors.header).should('be.visible')
    cy.get(UsersTable.selectors.tabsList).should('be.visible')
    cy.url().should('include', '/sector7/users')
    
    return this
  }

  /**
   * Navega de vuelta al dashboard de Sector7
   */
  navigateBackToSector7() {
    cy.get(UsersTable.selectors.backButton).click()
    cy.url().should('include', '/sector7')
    cy.url().should('not.include', '/users')
    
    return this
  }

  /**
   * Cambia a la pestaña de usuarios regulares
   */
  switchToUsersTab() {
    cy.get(UsersTable.selectors.usersTab).click()
    
    return this
  }

  /**
   * Cambia a la pestaña de superadministradores
   */
  switchToSuperadminsTab() {
    cy.get(UsersTable.selectors.superadminsTab).click()
    
    return this
  }

  /**
   * Valida estadísticas de usuarios
   */
  validateUserStats() {
    cy.get(UsersTable.selectors.statsCards).should('be.visible')
    
    // Verificar que las tarjetas muestran números
    cy.get(UsersTable.selectors.totalUsersCard).within(() => {
      cy.get('.text-2xl').should('not.be.empty')
    })
    
    cy.get(UsersTable.selectors.regularUsersCard).within(() => {
      cy.get('.text-2xl').should('not.be.empty')
    })
    
    cy.get(UsersTable.selectors.superadminsCard).within(() => {
      cy.get('.text-2xl').should('not.be.empty')
    })
    
    return this
  }

  /**
   * Valida que la tabla de usuarios está cargada
   */
  validateUsersTableLoaded() {
    cy.get(UsersTable.selectors.usersTable).should('be.visible')
    cy.get(UsersTable.selectors.tableHeader).should('be.visible')
    cy.get(UsersTable.selectors.tableBody).should('be.visible')
    
    return this
  }

  /**
   * Valida que hay usuarios en la tabla
   */
  validateUsersExist(minimumCount = 1) {
    cy.get(UsersTable.selectors.tableRow)
      .should('have.length.at.least', minimumCount)
    
    return this
  }

  /**
   * Valida estructura de la tabla
   */
  validateTableStructure() {
    // Verificar headers de la tabla
    cy.get(UsersTable.selectors.tableHeader).within(() => {
      cy.contains('Email').should('be.visible')
      cy.contains('Name').should('be.visible')
      cy.contains('Role').should('be.visible')
      cy.contains('Status').should('be.visible')
      cy.contains('Actions').should('be.visible')
    })
    
    return this
  }

  /**
   * Valida contenido de una fila específica
   */
  validateUserRow(rowIndex, expectedUser) {
    cy.get(UsersTable.selectors.tableRow).eq(rowIndex).within(() => {
      if (expectedUser.email) {
        cy.get(UsersTable.selectors.emailColumn)
          .should('contain.text', expectedUser.email)
      }
      
      if (expectedUser.name) {
        cy.get(UsersTable.selectors.nameColumn)
          .should('contain.text', expectedUser.name)
      }
      
      if (expectedUser.role) {
        cy.get(UsersTable.selectors.roleColumn)
          .should('contain.text', expectedUser.role)
      }
      
      if (expectedUser.status) {
        cy.get(UsersTable.selectors.statusColumn)
          .should('contain.text', expectedUser.status)
      }
    })
    
    return this
  }

  /**
   * Search users - general method
   */
  searchUsers(searchTerm) {
    cy.get(UsersTable.selectors.searchInput).then(($search) => {
      if ($search.length > 0) {
        cy.wrap($search).clear().type(searchTerm)
        cy.wait(500) // Esperar filtrado
      }
    })
    
    return this
  }

  /**
   * Busca un usuario por email
   */
  searchUserByEmail(email) {
    cy.get(UsersTable.selectors.searchInput).then(($search) => {
      if ($search.length > 0) {
        cy.wrap($search).clear().type(email)
        cy.wait(500) // Esperar filtrado
      }
    })
    
    return this
  }

  /**
   * Filtra usuarios por rol
   */
  filterByRole(role) {
    cy.get(UsersTable.selectors.filterSelect).then(($filter) => {
      if ($filter.length > 0) {
        cy.wrap($filter).select(role)
      }
    })
    
    return this
  }

  /**
   * Edita un usuario específico
   */
  editUser(userIndex = 0) {
    cy.get(UsersTable.selectors.tableRow).eq(userIndex).within(() => {
      cy.get(UsersTable.selectors.editUserButton).click()
    })
    
    // Verificar que se abrió el modal/formulario
    cy.get(UsersTable.selectors.userModal).should('be.visible')
    
    return this
  }

  /**
   * Elimina un usuario específico
   */
  deleteUser(userIndex = 0) {
    cy.get(UsersTable.selectors.tableRow).eq(userIndex).within(() => {
      cy.get(UsersTable.selectors.deleteUserButton).click()
    })
    
    // Confirmar eliminación en modal
    cy.get(UsersTable.selectors.deleteModal).should('be.visible')
    cy.get(UsersTable.selectors.confirmDelete).click()
    
    return this
  }

  /**
   * Cancela eliminación de usuario
   */
  cancelUserDeletion() {
    cy.get(UsersTable.selectors.cancelDelete).click()
    cy.get(UsersTable.selectors.deleteModal).should('not.exist')
    
    return this
  }

  /**
   * Cambia el estado de un usuario
   */
  toggleUserStatus(userIndex = 0) {
    cy.get(UsersTable.selectors.tableRow).eq(userIndex).within(() => {
      cy.get(UsersTable.selectors.toggleStatusButton).click()
    })
    
    return this
  }

  /**
   * Ve detalles de un usuario
   */
  viewUserDetails(userIndex = 0) {
    cy.get(UsersTable.selectors.tableRow).eq(userIndex).within(() => {
      cy.get(UsersTable.selectors.viewUserButton).click()
    })
    
    return this
  }

  /**
   * Valida badges de estado
   */
  validateStatusBadges() {
    // Activo
    cy.get(UsersTable.selectors.activeBadge).then(($active) => {
      if ($active.length > 0) {
        cy.wrap($active).should('contain.text', 'Active')
      }
    })
    
    // Inactivo
    cy.get(UsersTable.selectors.inactiveBadge).then(($inactive) => {
      if ($inactive.length > 0) {
        cy.wrap($inactive).should('contain.text', 'Inactive')
      }
    })
    
    return this
  }

  /**
   * Valida badges de rol
   */
  validateRoleBadges() {
    cy.get(UsersTable.selectors.roleBadge).each(($badge) => {
      cy.wrap($badge).should('not.be.empty')
      cy.wrap($badge).should('contain.text', 'member')
        .or('contain.text', 'admin')
        .or('contain.text', 'superadmin')
    })
    
    return this
  }

  /**
   * Actualiza la tabla
   */
  refreshTable() {
    cy.get(UsersTable.selectors.refreshButton).click()
    
    // Verificar estado de carga
    cy.get(UsersTable.selectors.loadingState).should('be.visible')
    cy.get(UsersTable.selectors.loadingState).should('not.exist')
    
    return this
  }

  /**
   * Valida estado de carga
   */
  validateLoadingState() {
    cy.get(UsersTable.selectors.loadingState).should('be.visible')
    
    return this
  }

  /**
   * Valida que terminó de cargar
   */
  validateLoadingCompleted() {
    cy.get(UsersTable.selectors.loadingState).should('not.exist')
    
    return this
  }

  /**
   * Valida estado vacío
   */
  validateEmptyState() {
    cy.get(UsersTable.selectors.emptyState).should('be.visible')
    cy.get(UsersTable.selectors.tableRow).should('not.exist')
    
    return this
  }

  /**
   * Valida estado de error
   */
  validateErrorState() {
    cy.get(UsersTable.selectors.errorState).should('be.visible')
    
    return this
  }

  /**
   * Valida paginación
   */
  validatePagination() {
    cy.get(UsersTable.selectors.pagination).then(($pagination) => {
      if ($pagination.length > 0) {
        cy.wrap($pagination).should('be.visible')
        cy.get(UsersTable.selectors.pageInfo).should('be.visible')
      }
    })
    
    return this
  }

  /**
   * Navega a página siguiente
   */
  goToNextPage() {
    cy.get(UsersTable.selectors.nextButton).then(($next) => {
      if ($next.length > 0 && !$next.is(':disabled')) {
        cy.wrap($next).click()
      }
    })
    
    return this
  }

  /**
   * Navega a página anterior
   */
  goToPreviousPage() {
    cy.get(UsersTable.selectors.previousButton).then(($prev) => {
      if ($prev.length > 0 && !$prev.is(':disabled')) {
        cy.wrap($prev).click()
      }
    })
    
    return this
  }

  /**
   * Crea nuevo usuario
   */
  createNewUser() {
    cy.get(UsersTable.selectors.createUserButton).then(($create) => {
      if ($create.length > 0) {
        cy.wrap($create).click()
        cy.get(UsersTable.selectors.userModal).should('be.visible')
      }
    })
    
    return this
  }

  /**
   * Valida formulario de usuario
   */
  validateUserForm() {
    cy.get(UsersTable.selectors.userForm).should('be.visible')
    cy.get(UsersTable.selectors.userForm).within(() => {
      cy.get('#email').should('be.visible')
      cy.get('#firstName').should('be.visible')
      cy.get('#lastName').should('be.visible')
      cy.get('#role').should('be.visible')
    })
    
    return this
  }

  /**
   * Valida accesibilidad de la tabla
   */
  validateAccessibility() {
    // Verificar roles ARIA
    cy.get(UsersTable.selectors.usersTable)
      .should('have.attr', 'role', 'table')
      .or('have.attr', 'aria-label')
    
    // Verificar navegación por teclado
    cy.get(UsersTable.selectors.usersTab).focus()
    cy.tab()
    cy.focused().should('exist')
    
    return this
  }

  /**
   * Valida comportamiento responsive
   */
  validateResponsiveBehavior() {
    // Mobile: tabla debería ser scrollable
    cy.viewport(375, 667)
    cy.get(UsersTable.selectors.usersTable).should('be.visible')
    
    // Desktop: tabla completa visible
    cy.viewport(1200, 800)
    cy.get(UsersTable.selectors.usersTable).should('be.visible')
    
    return this
  }

  /**
   * Valida ordenamiento de la tabla
   */
  validateTableSorting() {
    // Click en header de email para ordenar
    cy.get('th:contains("Email")').then(($emailHeader) => {
      if ($emailHeader.length > 0) {
        cy.wrap($emailHeader).click()
        
        // Verificar indicador de ordenamiento
        cy.wrap($emailHeader).should('have.attr', 'aria-sort')
          .or('contain', '↑')
          .or('contain', '↓')
      }
    })
    
    return this
  }

  /**
   * Valida permisos de superadmin
   */
  validateSuperAdminPermissions() {
    // Superadmin debería ver todas las acciones
    cy.get(UsersTable.selectors.editUserButton).should('be.visible')
    cy.get(UsersTable.selectors.deleteUserButton).should('be.visible')
    cy.get(UsersTable.selectors.toggleStatusButton).should('be.visible')
    
    return this
  }

  /**
   * Valida datos específicos de superadministradores
   */
  validateSuperadminsTabContent() {
    this.switchToSuperadminsTab()
    
    // Verificar que muestra solo superadministradores
    cy.get(UsersTable.selectors.tableRow).each(($row) => {
      cy.wrap($row).within(() => {
        cy.get(UsersTable.selectors.roleColumn)
          .should('contain.text', 'superadmin')
      })
    })
    
    return this
  }

  // ========================================
  // MÉTODOS REQUERIDOS POR LOS TESTS
  // ========================================

  /**
   * Valida que la página de usuarios está cargada
   */
  validateUsersPageLoaded() {
    cy.get(UsersTable.selectors.container).should('be.visible')
    cy.get(UsersTable.selectors.usersTable).should('be.visible')
    cy.get(UsersTable.selectors.tableHeader).should('be.visible')
    return this
  }

  /**
   * Valida error de carga de usuarios
   */
  validateUsersLoadingError() {
    cy.get(UsersTable.selectors.errorMessage).should('be.visible')
      .and('contain.text', 'Error loading users')
    return this
  }

  /**
   * Valida error de actualización de usuario
   */
  validateUserUpdateError() {
    cy.get(UsersTable.selectors.errorMessage).should('be.visible')
      .and('contain.text', 'Failed to update user')
    return this
  }

  /**
   * Valida error de rate limit
   */
  validateRateLimitError() {
    cy.get(UsersTable.selectors.errorMessage).should('be.visible')
      .and('contain.text', 'Too many requests')
    return this
  }
}
