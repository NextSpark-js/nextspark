/**
 * StyleGallery - Page Object Model Class
 * 
 * Encapsula funcionalidad de la galería de estilos y componentes de Sector7
 * Mapea test cases: SEC7_029-036 de sector7-style.cy.md
 */
export class StyleGallery {
  static selectors = {
    // Página principal de style gallery
    stylePage: '[data-cy="sector7-style-page"]',
    galleryContainer: '[data-cy="style-gallery-container"]',
    styleLoading: '[data-cy="style-loading"]',
    
    // Navegación por tabs
    styleTabs: '[data-cy="style-tabs"]',
    tabComponents: '[data-cy="tab-components"]',
    tabTheme: '[data-cy="tab-theme"]',
    tabGuidelines: '[data-cy="tab-guidelines"]',
    
    // Tab de componentes
    componentsShowcase: '[data-cy="components-showcase"]',
    componentCategory: '[data-cy="component-category"]',
    componentExample: '[data-cy="component-example"]',
    componentCode: '[data-cy="component-code"]',
    
    // Categorías específicas de componentes
    buttonsCategory: '[data-cy="category-buttons"]',
    formsCategory: '[data-cy="category-forms"]',
    cardsCategory: '[data-cy="category-cards"]',
    navigationCategory: '[data-cy="category-navigation"]',
    
    // Tab de tema y colores
    themePreview: '[data-cy="theme-preview"]',
    lightThemePreview: '[data-cy="light-theme-preview"]',
    darkThemePreview: '[data-cy="dark-theme-preview"]',
    colorPalette: '[data-cy="color-palette"]',
    colorSwatch: '[data-cy="color-swatch"]',
    
    // Tab de guidelines
    guidelinesContent: '[data-cy="guidelines-content"]',
    designPrinciples: '[data-cy="design-principles"]',
    usageExamples: '[data-cy="usage-examples"]',
    
    // Controles de la galería
    searchComponents: '[data-cy="search-components"]',
    filterComponents: '[data-cy="filter-components"]',
    viewModeToggle: '[data-cy="view-mode-toggle"]',
    
    // Modos de vista
    gridView: '[data-cy="grid-view"]',
    listView: '[data-cy="list-view"]',
    detailView: '[data-cy="detail-view"]',
    
    // Elementos de componente individual
    componentCard: '.component-card',
    componentTitle: '.component-title',
    componentDescription: '.component-description',
    componentVariants: '[data-cy="component-variants"]',
    variantItem: '[data-cy="variant-item"]',
    
    // Código y documentación
    codeBlock: '[data-cy="code-block"]',
    copyCodeButton: '[data-cy="copy-code"]',
    codeLanguageSelect: '[data-cy="code-language"]',
    
    // Estados y previews
    componentPreview: '[data-cy="component-preview"]',
    previewFrame: '[data-cy="preview-frame"]',
    previewControls: '[data-cy="preview-controls"]',
    
    // Responsive previews
    mobilePreview: '[data-cy="mobile-preview"]',
    tabletPreview: '[data-cy="tablet-preview"]',
    desktopPreview: '[data-cy="desktop-preview"]',
    
    // Navigation breadcrumb
    breadcrumb: '[data-cy="style-breadcrumb"]',
    backToSector7: '[data-cy="back-to-sector7"]',
  }

  /**
   * Valida que la galería de estilos está cargada
   */
  validateStyleGalleryLoaded() {
    cy.get(StyleGallery.selectors.stylePage).should('be.visible')
    cy.get(StyleGallery.selectors.galleryContainer).should('be.visible')
    cy.get(StyleGallery.selectors.styleTabs).should('be.visible')
    cy.url().should('include', '/sector7/style')
    
    return this
  }

  /**
   * Navega al tab de componentes
   */
  switchToComponentsTab() {
    cy.get(StyleGallery.selectors.tabComponents).click()
    cy.get(StyleGallery.selectors.componentsShowcase).should('be.visible')
    
    return this
  }

  /**
   * Navega al tab de tema
   */
  switchToThemeTab() {
    cy.get(StyleGallery.selectors.tabTheme).click()
    cy.get(StyleGallery.selectors.themePreview).should('be.visible')
    
    return this
  }

  /**
   * Navega al tab de guidelines
   */
  switchToGuidelinesTab() {
    cy.get(StyleGallery.selectors.tabGuidelines).click()
    cy.get(StyleGallery.selectors.guidelinesContent).should('be.visible')
    
    return this
  }

  /**
   * Valida showcase de componentes
   */
  validateComponentsShowcase() {
    cy.get(StyleGallery.selectors.componentsShowcase).should('be.visible')
    cy.get(StyleGallery.selectors.componentCategory).should('have.length.at.least', 3)
    
    return this
  }

  /**
   * Valida categoría específica de componentes
   */
  validateComponentCategory(categoryName) {
    const categorySelectors = {
      buttons: StyleGallery.selectors.buttonsCategory,
      forms: StyleGallery.selectors.formsCategory,
      cards: StyleGallery.selectors.cardsCategory,
      navigation: StyleGallery.selectors.navigationCategory
    }
    
    if (categorySelectors[categoryName]) {
      cy.get(categorySelectors[categoryName]).should('be.visible')
      cy.get(categorySelectors[categoryName]).within(() => {
        cy.get(StyleGallery.selectors.componentExample).should('have.length.at.least', 1)
      })
    }
    
    return this
  }

  /**
   * Valida ejemplo de componente específico
   */
  validateComponentExample(exampleIndex = 0) {
    cy.get(StyleGallery.selectors.componentExample).eq(exampleIndex).within(() => {
      cy.get(StyleGallery.selectors.componentTitle).should('be.visible')
      cy.get(StyleGallery.selectors.componentPreview).should('be.visible')
    })
    
    return this
  }

  /**
   * Valida código de componente
   */
  validateComponentCode(exampleIndex = 0) {
    cy.get(StyleGallery.selectors.componentExample).eq(exampleIndex).within(() => {
      cy.get(StyleGallery.selectors.componentCode).should('be.visible')
      cy.get(StyleGallery.selectors.codeBlock).should('be.visible')
    })
    
    return this
  }

  /**
   * Copia código de componente
   */
  copyComponentCode(exampleIndex = 0) {
    cy.get(StyleGallery.selectors.componentExample).eq(exampleIndex).within(() => {
      cy.get(StyleGallery.selectors.copyCodeButton).click()
    })
    
    // Verificar que se copió (esto dependería de la implementación)
    cy.window().its('navigator.clipboard').then((clipboard) => {
      if (clipboard) {
        // Validar que el clipboard tiene contenido
        clipboard.readText().then((text) => {
          expect(text).to.not.be.empty
        })
      }
    })
    
    return this
  }

  /**
   * Cambia lenguaje de código
   */
  changeCodeLanguage(language) {
    cy.get(StyleGallery.selectors.codeLanguageSelect).select(language)
    
    return this
  }

  /**
   * Valida preview de tema
   */
  validateThemePreview() {
    cy.get(StyleGallery.selectors.themePreview).should('be.visible')
    cy.get(StyleGallery.selectors.lightThemePreview).should('be.visible')
    cy.get(StyleGallery.selectors.darkThemePreview).should('be.visible')
    
    return this
  }

  /**
   * Valida paleta de colores
   */
  validateColorPalette() {
    cy.get(StyleGallery.selectors.colorPalette).should('be.visible')
    cy.get(StyleGallery.selectors.colorSwatch).should('have.length.at.least', 5)
    
    return this
  }

  /**
   * Hace click en un color de la paleta
   */
  clickColorSwatch(swatchIndex = 0) {
    cy.get(StyleGallery.selectors.colorSwatch).eq(swatchIndex).click()
    
    // Verificar que se muestra información del color
    cy.get('[data-cy="color-info"]').then(($info) => {
      if ($info.length > 0) {
        cy.wrap($info).should('be.visible')
      }
    })
    
    return this
  }

  /**
   * Valida guidelines de diseño
   */
  validateDesignGuidelines() {
    cy.get(StyleGallery.selectors.guidelinesContent).should('be.visible')
    cy.get(StyleGallery.selectors.designPrinciples).should('be.visible')
    cy.get(StyleGallery.selectors.usageExamples).should('be.visible')
    
    return this
  }

  /**
   * Busca componentes
   */
  searchComponents(query) {
    cy.get(StyleGallery.selectors.searchComponents).then(($search) => {
      if ($search.length > 0) {
        cy.wrap($search).clear().type(query)
        cy.wait(500) // Esperar filtrado
      }
    })
    
    return this
  }

  /**
   * Filtra componentes por categoría
   */
  filterComponentsByCategory(category) {
    cy.get(StyleGallery.selectors.filterComponents).then(($filter) => {
      if ($filter.length > 0) {
        cy.wrap($filter).select(category)
      }
    })
    
    return this
  }

  /**
   * Cambia modo de vista
   */
  switchViewMode(mode) {
    const viewModes = {
      grid: StyleGallery.selectors.gridView,
      list: StyleGallery.selectors.listView,
      detail: StyleGallery.selectors.detailView
    }
    
    if (viewModes[mode]) {
      cy.get(StyleGallery.selectors.viewModeToggle).click()
      cy.get(viewModes[mode]).click()
    }
    
    return this
  }

  /**
   * Valida variantes de componente
   */
  validateComponentVariants(componentIndex = 0) {
    cy.get(StyleGallery.selectors.componentExample).eq(componentIndex).within(() => {
      cy.get(StyleGallery.selectors.componentVariants).then(($variants) => {
        if ($variants.length > 0) {
          cy.wrap($variants).should('be.visible')
          cy.get(StyleGallery.selectors.variantItem).should('have.length.at.least', 1)
        }
      })
    })
    
    return this
  }

  /**
   * Selecciona variante específica
   */
  selectComponentVariant(componentIndex, variantIndex) {
    cy.get(StyleGallery.selectors.componentExample).eq(componentIndex).within(() => {
      cy.get(StyleGallery.selectors.variantItem).eq(variantIndex).click()
      
      // Verificar que el preview se actualiza
      cy.get(StyleGallery.selectors.componentPreview).should('be.visible')
    })
    
    return this
  }

  /**
   * Valida previews responsive
   */
  validateResponsivePreviews() {
    cy.get(StyleGallery.selectors.previewControls).then(($controls) => {
      if ($controls.length > 0) {
        cy.wrap($controls).should('be.visible')
        
        // Mobile preview
        cy.get(StyleGallery.selectors.mobilePreview).click()
        cy.get(StyleGallery.selectors.previewFrame).should('have.css', 'width', '375px')
        
        // Desktop preview
        cy.get(StyleGallery.selectors.desktopPreview).click()
        cy.get(StyleGallery.selectors.previewFrame).should('have.css', 'width', '1200px')
      }
    })
    
    return this
  }

  /**
   * Navega de vuelta a Sector7
   */
  navigateBackToSector7() {
    cy.get(StyleGallery.selectors.backToSector7).click()
    cy.url().should('include', '/sector7')
    cy.url().should('not.include', '/style')
    
    return this
  }

  /**
   * Valida breadcrumb navigation
   */
  validateBreadcrumb() {
    cy.get(StyleGallery.selectors.breadcrumb).should('be.visible')
    cy.get(StyleGallery.selectors.breadcrumb).should('contain.text', 'Sector7')
    cy.get(StyleGallery.selectors.breadcrumb).should('contain.text', 'Style Gallery')
    
    return this
  }

  /**
   * Valida estado de carga
   */
  validateLoadingState() {
    cy.get(StyleGallery.selectors.styleLoading).should('be.visible')
    
    return this
  }

  /**
   * Valida que terminó de cargar
   */
  validateLoadingCompleted() {
    cy.get(StyleGallery.selectors.styleLoading).should('not.exist')
    
    return this
  }

  /**
   * Valida acceso solo para superadmin
   */
  validateSuperAdminAccess() {
    // Verificar que la página carga correctamente para superadmin
    this.validateStyleGalleryLoaded()
    
    // Verificar presencia de elementos exclusivos para superadmin
    cy.get(StyleGallery.selectors.componentsShowcase).should('be.visible')
    cy.get(StyleGallery.selectors.themePreview).should('be.visible')
    
    return this
  }

  /**
   * Valida que usuario normal no puede acceder
   */
  validateMemberAccessDenied() {
    // Debería redirigir o mostrar error de acceso
    cy.url().should('not.include', '/sector7/style')
      .or('contain', '/403')
      .or('contain', '/login')
    
    return this
  }

  /**
   * Valida comportamiento responsive de la galería
   */
  validateResponsiveBehavior() {
    // Desktop: vista completa
    cy.viewport(1200, 800)
    this.validateStyleGalleryLoaded()
    
    // Mobile: layout adaptado
    cy.viewport(375, 667)
    cy.get(StyleGallery.selectors.galleryContainer).should('be.visible')
    
    return this
  }

  /**
   * Valida accesibilidad
   */
  validateAccessibility() {
    // Verificar estructura de headings
    cy.get('h1').should('exist')
    
    // Verificar roles ARIA en tabs
    cy.get(StyleGallery.selectors.styleTabs)
      .should('have.attr', 'role', 'tablist')
    
    cy.get(StyleGallery.selectors.tabComponents)
      .should('have.attr', 'role', 'tab')
      .and('have.attr', 'aria-selected')
    
    // Navegación por teclado
    cy.get(StyleGallery.selectors.tabComponents).focus()
    cy.get(StyleGallery.selectors.tabComponents).type('{rightarrow}')
    cy.get(StyleGallery.selectors.tabTheme).should('be.focused')
    
    return this
  }

  /**
   * Valida integración con sistema de temas
   */
  validateThemeIntegration() {
    // Cambiar al tab de tema
    this.switchToThemeTab()
    
    // Verificar que los previews reflejan el tema actual
    cy.get('html').then(($html) => {
      const isDark = $html.hasClass('dark')
      
      if (isDark) {
        cy.get(StyleGallery.selectors.darkThemePreview)
          .should('have.class', 'active')
      } else {
        cy.get(StyleGallery.selectors.lightThemePreview)
          .should('have.class', 'active')
      }
    })
    
    return this
  }

  /**
   * Valida exportación de assets
   */
  validateAssetExport() {
    cy.get('[data-cy="export-assets"]').then(($export) => {
      if ($export.length > 0) {
        cy.wrap($export).click()
        // Verificar descarga o modal de export
      }
    })
    
    return this
  }

  /**
   * Valida documentación de componentes
   */
  validateComponentDocumentation() {
    cy.get(StyleGallery.selectors.componentExample).first().within(() => {
      cy.get('[data-cy="component-docs"]').then(($docs) => {
        if ($docs.length > 0) {
          cy.wrap($docs).click()
          cy.get('[data-cy="docs-modal"]').should('be.visible')
        }
      })
    })
    
    return this
  }

  // ========================================
  // MÉTODOS REQUERIDOS POR LOS TESTS
  // ========================================

  /**
   * Valida acceso denegado para miembros
   */
  validateMemberAccessDenied() {
    cy.get(StyleGallery.selectors.errorState).should('be.visible')
      .and('contain.text', 'Access denied')
    cy.get('[data-cy="unauthorized-message"]').should('be.visible')
    return this
  }

  /**
   * Valida error en style gallery
   */
  validateStyleGalleryError() {
    cy.get(StyleGallery.selectors.errorState).should('be.visible')
      .and('contain.text', 'Error loading style gallery')
    return this
  }
}
