/**
 * SearchDropdown - Page Object Model Class
 * 
 * Encapsula funcionalidad de la búsqueda global de la aplicación
 * Mapea test cases: SEARCH_001-008 de global-search.cy.md
 */
export class SearchDropdown {
  static selectors = {
    // Elementos principales de búsqueda
    searchDropdown: '[data-cy="search-dropdown"]',
    searchInput: '[data-cy="global-search-input"]',
    searchTrigger: '[data-cy="search-trigger"]',
    searchResults: '[data-cy="search-results"]',
    
    // Elementos de resultados
    resultItem: '[data-cy="search-result-item"]',
    resultTitle: '[data-cy="result-title"]',
    resultDescription: '[data-cy="result-description"]',
    resultCategory: '[data-cy="result-category"]',
    
    // Estados de búsqueda
    searchEmpty: '[data-cy="search-empty"]',
    searchLoading: '[data-cy="search-loading"]',
    searchError: '[data-cy="search-error"]',
    
    // Sugerencias y filtros
    searchSuggestions: '[data-cy="search-suggestions"]',
    suggestionItem: '[data-cy="suggestion-item"]',
    searchFilters: '[data-cy="search-filters"]',
    filterButton: '[data-cy="filter-button"]',
    
    // Categorías de resultados
    tasksResults: '[data-cy="tasks-results"]',
    usersResults: '[data-cy="users-results"]',
    settingsResults: '[data-cy="settings-results"]',
    
    // Elementos del dropdown según componente real
    searchSection: '[data-cy="topnav-search-section"]',
    clearButton: '[data-cy="search-clear"]',
    
    // Shortcuts y controles
    searchOverlay: '[data-cy="search-overlay"]',
    closeButton: '[data-cy="search-close"]',
    
    // Historial de búsqueda
    recentSearches: '[data-cy="recent-searches"]',
    recentItem: '[data-cy="recent-item"]',
    clearHistory: '[data-cy="clear-history"]',
  }

  /**
   * Abre el dropdown de búsqueda
   */
  openSearch() {
    cy.get(SearchDropdown.selectors.searchSection).click()
    cy.get(SearchDropdown.selectors.searchDropdown).should('be.visible')
    
    return this
  }

  /**
   * Abre búsqueda con shortcut de teclado
   */
  openSearchWithKeyboard() {
    cy.get('body').type('{cmd}k')
    cy.get(SearchDropdown.selectors.searchInput).should('be.focused')
    
    return this
  }

  /**
   * Cierra el dropdown de búsqueda
   */
  closeSearch() {
    cy.get(SearchDropdown.selectors.closeButton).click()
    cy.get(SearchDropdown.selectors.searchDropdown).should('not.exist')
    
    return this
  }

  /**
   * Realiza una búsqueda
   */
  performSearch(query) {
    cy.get(SearchDropdown.selectors.searchInput)
      .clear()
      .type(query)
    
    // Esperar que aparezcan resultados
    cy.get(SearchDropdown.selectors.searchResults).should('be.visible')
    
    return this
  }

  /**
   * Valida que aparecen resultados de búsqueda
   */
  validateSearchResults(expectedCount = null) {
    cy.get(SearchDropdown.selectors.searchResults).should('be.visible')
    
    if (expectedCount !== null) {
      cy.get(SearchDropdown.selectors.resultItem)
        .should('have.length', expectedCount)
    } else {
      cy.get(SearchDropdown.selectors.resultItem)
        .should('have.length.at.least', 1)
    }
    
    return this
  }

  /**
   * Valida estructura de un resultado específico
   */
  validateResultItem(index, expectedResult) {
    cy.get(SearchDropdown.selectors.resultItem).eq(index).within(() => {
      if (expectedResult.title) {
        cy.get(SearchDropdown.selectors.resultTitle)
          .should('contain.text', expectedResult.title)
      }
      
      if (expectedResult.description) {
        cy.get(SearchDropdown.selectors.resultDescription)
          .should('contain.text', expectedResult.description)
      }
      
      if (expectedResult.category) {
        cy.get(SearchDropdown.selectors.resultCategory)
          .should('contain.text', expectedResult.category)
      }
    })
    
    return this
  }

  /**
   * Hace click en un resultado específico
   */
  clickResult(index = 0) {
    cy.get(SearchDropdown.selectors.resultItem).eq(index).click()
    
    return this
  }

  /**
   * Valida estado vacío (sin resultados)
   */
  validateEmptyResults() {
    cy.get(SearchDropdown.selectors.searchEmpty)
      .should('be.visible')
      .and('contain.text', 'No results found')
    
    return this
  }

  /**
   * Valida estado de carga
   */
  validateLoadingState() {
    cy.get(SearchDropdown.selectors.searchLoading).should('be.visible')
    
    return this
  }

  /**
   * Valida que terminó de cargar
   */
  validateLoadingCompleted() {
    cy.get(SearchDropdown.selectors.searchLoading).should('not.exist')
    
    return this
  }

  /**
   * Valida sugerencias de búsqueda
   */
  validateSearchSuggestions() {
    cy.get(SearchDropdown.selectors.searchSuggestions).should('be.visible')
    cy.get(SearchDropdown.selectors.suggestionItem)
      .should('have.length.at.least', 1)
    
    return this
  }

  /**
   * Hace click en una sugerencia
   */
  clickSuggestion(index = 0) {
    cy.get(SearchDropdown.selectors.suggestionItem).eq(index).click()
    
    return this
  }

  /**
   * Limpia el campo de búsqueda
   */
  clearSearch() {
    cy.get(SearchDropdown.selectors.clearButton).click()
    cy.get(SearchDropdown.selectors.searchInput).should('have.value', '')
    
    return this
  }

  /**
   * Valida filtros de búsqueda por categoría
   */
  validateCategoryFilters() {
    cy.get(SearchDropdown.selectors.searchFilters).should('be.visible')
    cy.get(SearchDropdown.selectors.filterButton)
      .should('have.length.at.least', 2)
    
    return this
  }

  /**
   * Aplica filtro por categoría
   */
  filterByCategory(category) {
    cy.get(SearchDropdown.selectors.filterButton)
      .contains(category)
      .click()
    
    return this
  }

  /**
   * Valida resultados de tasks
   */
  validateTasksResults() {
    cy.get(SearchDropdown.selectors.tasksResults).should('be.visible')
    cy.get(SearchDropdown.selectors.tasksResults).within(() => {
      cy.get(SearchDropdown.selectors.resultItem)
        .should('have.length.at.least', 1)
    })
    
    return this
  }

  /**
   * Valida resultados de usuarios
   */
  validateUsersResults() {
    cy.get(SearchDropdown.selectors.usersResults).should('be.visible')
    cy.get(SearchDropdown.selectors.usersResults).within(() => {
      cy.get(SearchDropdown.selectors.resultItem)
        .should('have.length.at.least', 1)
    })
    
    return this
  }

  /**
   * Valida resultados de configuraciones
   */
  validateSettingsResults() {
    cy.get(SearchDropdown.selectors.settingsResults).should('be.visible')
    cy.get(SearchDropdown.selectors.settingsResults).within(() => {
      cy.get(SearchDropdown.selectors.resultItem)
        .should('have.length.at.least', 1)
    })
    
    return this
  }

  /**
   * Valida navegación por teclado en resultados
   */
  validateKeyboardNavigation() {
    // Flecha abajo para navegar resultados
    cy.get(SearchDropdown.selectors.searchInput).type('{downarrow}')
    cy.get(SearchDropdown.selectors.resultItem).first()
      .should('have.class', 'highlighted')
      .or('have.attr', 'aria-selected', 'true')
    
    // Enter para seleccionar
    cy.get(SearchDropdown.selectors.searchInput).type('{enter}')
    
    return this
  }

  /**
   * Valida historial de búsquedas recientes
   */
  validateRecentSearches() {
    cy.get(SearchDropdown.selectors.recentSearches).then(($recent) => {
      if ($recent.length > 0) {
        cy.wrap($recent).should('be.visible')
        cy.get(SearchDropdown.selectors.recentItem)
          .should('have.length.at.least', 1)
      }
    })
    
    return this
  }

  /**
   * Limpia historial de búsquedas
   */
  clearSearchHistory() {
    cy.get(SearchDropdown.selectors.clearHistory).then(($clear) => {
      if ($clear.length > 0) {
        cy.wrap($clear).click()
        cy.get(SearchDropdown.selectors.recentItem).should('not.exist')
      }
    })
    
    return this
  }

  /**
   * Valida búsqueda en tiempo real
   */
  validateRealTimeSearch(query) {
    // Escribir caracter por caracter y verificar que se actualiza
    query.split('').forEach((char, index) => {
      cy.get(SearchDropdown.selectors.searchInput).type(char)
      
      if (index >= 2) { // Después de 3 caracteres debería mostrar resultados
        cy.wait(300) // Debounce típico
        cy.get(SearchDropdown.selectors.searchResults).should('be.visible')
      }
    })
    
    return this
  }

  /**
   * Valida comportamiento responsive
   */
  validateResponsiveBehavior() {
    // Mobile
    cy.viewport(375, 667)
    this.openSearch()
    cy.get(SearchDropdown.selectors.searchDropdown).should('be.visible')
    
    // Desktop
    cy.viewport(1200, 800)
    cy.get(SearchDropdown.selectors.searchDropdown).should('be.visible')
    
    return this
  }

  /**
   * Valida accesibilidad
   */
  validateAccessibility() {
    // Verificar ARIA labels
    cy.get(SearchDropdown.selectors.searchInput)
      .should('have.attr', 'aria-label')
      .or('have.attr', 'aria-describedby')
    
    cy.get(SearchDropdown.selectors.searchResults)
      .should('have.attr', 'role', 'listbox')
      .or('have.attr', 'aria-live')
    
    // Verificar que resultados tienen roles apropiados
    cy.get(SearchDropdown.selectors.resultItem).first()
      .should('have.attr', 'role', 'option')
      .or('have.attr', 'tabindex')
    
    return this
  }

  /**
   * Valida overlay y cierre con click fuera
   */
  validateOverlayBehavior() {
    cy.get(SearchDropdown.selectors.searchOverlay).then(($overlay) => {
      if ($overlay.length > 0) {
        cy.wrap($overlay).click({ force: true })
        cy.get(SearchDropdown.selectors.searchDropdown).should('not.exist')
      }
    })
    
    return this
  }

  /**
   * Valida escape para cerrar
   */
  validateEscapeToClose() {
    cy.get(SearchDropdown.selectors.searchInput).type('{esc}')
    cy.get(SearchDropdown.selectors.searchDropdown).should('not.exist')
    
    return this
  }

  /**
   * Valida búsqueda sin resultados
   */
  validateNoResultsSearch() {
    const randomQuery = 'xyzabc123nonexistent'
    this.performSearch(randomQuery)
    this.validateEmptyResults()
    
    return this
  }

  /**
   * Valida error en búsqueda
   */
  validateSearchError() {
    cy.get(SearchDropdown.selectors.searchError).then(($error) => {
      if ($error.length > 0) {
        cy.wrap($error).should('be.visible')
        cy.wrap($error).should('contain.text', 'Error')
      }
    })
    
    return this
  }

  /**
   * Valida destacado de términos de búsqueda en resultados
   */
  validateHighlightedTerms(searchTerm) {
    cy.get(SearchDropdown.selectors.resultItem).first().within(() => {
      cy.get('.highlight, mark, .search-highlight').then(($highlighted) => {
        if ($highlighted.length > 0) {
          cy.wrap($highlighted).should('contain.text', searchTerm)
        }
      })
    })
    
    return this
  }
}
