/**
 * POC Test: Pages Block Editor Selectors Validation
 *
 * This test validates selectors specific to the Page Builder that are NOT
 * available in the Posts editor:
 * - Page Settings panel
 * - SEO settings (meta title, description, keywords)
 * - Locale selector
 *
 * Purpose:
 * - Validate selectors from BlockEditorBasePOM work correctly for pages
 * - Test page-specific features (SEO, locale)
 *
 * Scope:
 * - Only login and navigate
 * - Assert elements exist in DOM (no full CRUD operations)
 *
 * Test IDs:
 * - SEL_PGED_001: Pages List Page Selectors
 * - SEL_PGED_002: Block Editor Core Selectors
 * - SEL_PGED_003: Page Settings Selectors
 * - SEL_PGED_004: Block Picker Selectors
 * - SEL_PGED_005: Block Canvas and Settings
 * - SEL_PGED_006: Edit Existing Page
 */

import { PageBuilderPOM } from '../../src/features/PageBuilderPOM'
import { PagesPOM } from '../../src/entities/PagesPOM'
import { loginAsDefaultDeveloper } from '../../src/session-helpers'

// Team ID for developer's team (NextSpark Team)
const DEVELOPER_TEAM_ID = 'team-nextspark-001'

describe('Pages Block Editor Selectors Validation', { tags: ['@ui-selectors', '@pages', '@editor'] }, () => {
  const pageBuilder = PageBuilderPOM.create()
  const pages = PagesPOM.create()

  beforeEach(() => {
    loginAsDefaultDeveloper()
    // Set team context for entity API calls (pages is team-based)
    cy.window().then((win) => {
      win.localStorage.setItem('activeTeamId', DEVELOPER_TEAM_ID)
    })
  })

  // ============================================
  // SEL_PGED_001: PAGES LIST PAGE SELECTORS
  // ============================================
  describe('SEL_PGED_001: Pages List Page Selectors', { tags: '@SEL_PGED_001' }, () => {
    beforeEach(() => {
      pages.visitList()
      pages.waitForList()
    })

    it('should find pages table container', () => {
      cy.get(pages.selectors.tableContainer).should('exist')
    })

    it('should find pages add button', () => {
      cy.get(pages.selectors.addButton).should('exist')
    })

    it('should find at least one page row', () => {
      cy.get(pages.selectors.rowGeneric).should('have.length.at.least', 1)
    })
  })

  // ============================================
  // SEL_PGED_002: BLOCK EDITOR CORE SELECTORS
  // ============================================
  describe('SEL_PGED_002: Block Editor Core Selectors', { tags: '@SEL_PGED_002' }, () => {
    beforeEach(() => {
      pageBuilder.visitCreate()
      pageBuilder.waitForEditor()
    })

    it('should find editor container', () => {
      cy.get(pageBuilder.editorSelectors.container).should('exist')
    })

    it('should find title input', () => {
      cy.get(pageBuilder.editorSelectors.titleInput).should('exist')
    })

    it('should find slug input', () => {
      cy.get(pageBuilder.editorSelectors.slugInput).should('exist')
    })

    it('should find save button', () => {
      cy.get(pageBuilder.editorSelectors.saveButton).should('exist')
    })
  })

  // ============================================
  // SEL_PGED_003: PAGE SETTINGS SELECTORS
  // ============================================
  describe('SEL_PGED_003: Page Settings Selectors', { tags: '@SEL_PGED_003' }, () => {
    beforeEach(() => {
      // Navigate to edit an existing page to see page settings and SEO
      pages.visitList()
      pages.waitForList()

      cy.get(pages.selectors.rowGeneric)
        .first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const id = dataCy?.replace('pages-row-', '') || ''
          pageBuilder.visitEdit(id)
          pageBuilder.waitForEditor()
        })
    })

    it('should find entity fields sidebar in edit mode', () => {
      // Switch to "Campos" tab to see entity fields
      cy.get('[data-cy="sidebar-fields"]').click()
      // Uses entity-fields-sidebar instead of page-settings-panel
      cy.get(pageBuilder.editorSelectors.entityFieldsSidebar).should('exist')
    })

    // NOTE: SEO settings are not yet implemented in the page editor
    // These tests are skipped until the SEO section is added
    it.skip('should find SEO trigger in edit mode (SEO not implemented)', () => {
      cy.get('[data-cy="sidebar-fields"]').click()
      cy.get(pageBuilder.editorSelectors.seoTrigger).should('exist')
    })

    it.skip('should find SEO fields when expanded (SEO not implemented)', () => {
      cy.get('[data-cy="sidebar-fields"]').click()
      pageBuilder.openSeoSettings()
      cy.get(pageBuilder.editorSelectors.metaTitle).should('exist')
      cy.get(pageBuilder.editorSelectors.metaDescription).should('exist')
    })

    it('should find locale selector', () => {
      cy.get('[data-cy="sidebar-fields"]').click()
      // Uses field-locale pattern from entity fields
      cy.get(pageBuilder.pageSelectors.localeSelect).should('exist')
    })
  })

  // ============================================
  // SEL_PGED_004: BLOCK PICKER SELECTORS
  // ============================================
  describe('SEL_PGED_004: Block Picker Selectors', { tags: '@SEL_PGED_004' }, () => {
    beforeEach(() => {
      pageBuilder.visitCreate()
      pageBuilder.waitForEditor()
    })

    it('should find block picker container', () => {
      cy.get(pageBuilder.editorSelectors.blockPicker).should('exist')
    })

    it('should find hero block (common in pages)', () => {
      cy.get(pageBuilder.editorSelectors.blockItem('hero')).should('exist')
      cy.get(pageBuilder.editorSelectors.addBlock('hero')).should('exist')
    })
  })

  // ============================================
  // SEL_PGED_005: BLOCK CANVAS AND SETTINGS
  // ============================================
  describe('SEL_PGED_005: Block Canvas and Settings', { tags: '@SEL_PGED_005' }, () => {
    beforeEach(() => {
      pageBuilder.visitCreate()
      pageBuilder.waitForEditor()
    })

    it('should find empty state when no blocks added', () => {
      cy.get(pageBuilder.editorSelectors.blockCanvasEmpty).should('exist')
    })

    it('should find block canvas and settings when block is added', () => {
      // Add a hero block
      pageBuilder.addBlock('hero')

      // Canvas and settings should appear
      cy.get(pageBuilder.editorSelectors.blockCanvas).should('exist')
      cy.get(pageBuilder.editorSelectors.settingsPanel).should('exist')
      cy.get(pageBuilder.editorSelectors.tabContent).should('exist')
      cy.get(pageBuilder.editorSelectors.tabDesign).should('exist')
    })
  })

  // ============================================
  // SEL_PGED_006: EDIT EXISTING PAGE
  // ============================================
  describe('SEL_PGED_006: Edit Existing Page', { tags: '@SEL_PGED_006' }, () => {
    it('should find editor elements when editing an existing page', () => {
      // Get a page ID from the list
      pages.visitList()
      pages.waitForList()

      cy.get(pages.selectors.rowGeneric)
        .first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const id = dataCy?.replace('pages-row-', '') || ''

          // Navigate to edit
          pageBuilder.visitEdit(id)
          pageBuilder.waitForEditor()

          // Validate editor is loaded with existing content
          cy.get(pageBuilder.editorSelectors.container).should('exist')
          cy.get(pageBuilder.editorSelectors.titleInput).should('exist')
          cy.get(pageBuilder.editorSelectors.saveButton).should('exist')
        })
    })
  })
})
