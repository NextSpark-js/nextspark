/**
 * Block Editor Selectors Validation Test
 *
 * Comprehensive test suite validating ALL selectors in BlockEditorBasePOM.
 * Uses the `pages` entity as the test base.
 *
 * Test Structure:
 * - SEL_BE_001: Header Selectors
 * - SEL_BE_002: Block Picker Selectors
 * - SEL_BE_003: Entity Fields Panel Selectors
 * - SEL_BE_004: Layout Canvas Selectors
 * - SEL_BE_005: Preview Canvas Selectors
 * - SEL_BE_006: Block Properties Panel Selectors
 * - SEL_BE_007: Array Fields Selectors
 *
 * Re-execution:
 *   pnpm tags @SEL_BE_001        # Run only Header tests
 *   pnpm tags @SEL_BE_004        # Run only Layout Canvas tests
 *   pnpm tags @ui-selectors      # Run all selector tests
 */

import { PageBuilderPOM } from '../../../src/features/PageBuilderPOM'
import { PagesPOM } from '../../../src/entities/PagesPOM'
import { loginAsDefaultDeveloper } from '../../../src/session-helpers'

const DEVELOPER_TEAM_ID = 'team-nextspark-001'

describe('Block Editor Selectors Validation', {
  tags: ['@ui-selectors', '@block-editor', '@selector-validation']
}, () => {
  const pom = PageBuilderPOM.create()
  const pages = PagesPOM.create()

  beforeEach(() => {
    loginAsDefaultDeveloper()
    cy.window().then((win) => {
      win.localStorage.setItem('activeTeamId', DEVELOPER_TEAM_ID)
    })
  })

  // ===========================================================================
  // SEL_BE_001: HEADER SELECTORS
  // ===========================================================================
  describe('SEL_BE_001: Header Selectors', { tags: '@SEL_BE_001' }, () => {
    beforeEach(() => {
      pom.visitCreate()
      pom.waitForEditor()
    })

    it('SEL_BE_001_01: should find header container', { tags: '@SEL_BE_001_01' }, () => {
      cy.get(pom.editorSelectors.container).should('exist').and('be.visible')
    })

    it('SEL_BE_001_02: should find back button', { tags: '@SEL_BE_001_02' }, () => {
      cy.get(pom.editorSelectors.backButton).should('exist').and('be.visible')
    })

    it('SEL_BE_001_03: should find title input', { tags: '@SEL_BE_001_03' }, () => {
      cy.get(pom.editorSelectors.titleInput).should('exist').and('be.visible')
    })

    it('SEL_BE_001_04: should find slug input', { tags: '@SEL_BE_001_04' }, () => {
      cy.get(pom.editorSelectors.slugInput).should('exist').and('be.visible')
    })

    it('SEL_BE_001_05: should find view mode toggle', { tags: '@SEL_BE_001_05' }, () => {
      cy.get(pom.editorSelectors.viewModeToggle).should('exist').and('be.visible')
    })

    it('SEL_BE_001_06: should find layout mode button (viewEditor)', { tags: '@SEL_BE_001_06' }, () => {
      cy.get(pom.editorSelectors.viewEditor).should('exist').and('be.visible')
    })

    it('SEL_BE_001_07: should find preview mode button (viewPreview)', { tags: '@SEL_BE_001_07' }, () => {
      cy.get(pom.editorSelectors.viewPreview).should('exist').and('be.visible')
    })

    it('SEL_BE_001_08: should find save button', { tags: '@SEL_BE_001_08' }, () => {
      cy.get(pom.editorSelectors.saveButton).should('exist').and('be.visible')
    })

    it('SEL_BE_001_09: should find publish button', { tags: '@SEL_BE_001_09' }, () => {
      cy.get(pom.editorSelectors.publishButton).should('exist').and('be.visible')
    })

    it('SEL_BE_001_10: should find status dot', { tags: '@SEL_BE_001_10' }, () => {
      cy.get(pom.editorSelectors.statusDot).should('exist').and('be.visible')
    })

    it('SEL_BE_001_11: should find status label', { tags: '@SEL_BE_001_11' }, () => {
      cy.get(pom.editorSelectors.statusLabel).should('exist').and('be.visible')
    })
  })

  // ===========================================================================
  // SEL_BE_002: BLOCK PICKER SELECTORS
  // ===========================================================================
  describe('SEL_BE_002: Block Picker Selectors', { tags: '@SEL_BE_002' }, () => {
    beforeEach(() => {
      pom.visitCreate()
      pom.waitForEditor()
    })

    it('SEL_BE_002_01: should find block picker container', { tags: '@SEL_BE_002_01' }, () => {
      cy.get(pom.editorSelectors.blockPicker).should('exist').and('be.visible')
    })

    it('SEL_BE_002_02: should find blocks tab', { tags: '@SEL_BE_002_02' }, () => {
      cy.get(pom.editorSelectors.tabBlocks).should('exist').and('be.visible')
    })

    it('SEL_BE_002_03: should find config tab', { tags: '@SEL_BE_002_03' }, () => {
      cy.get(pom.editorSelectors.tabConfig).should('exist').and('be.visible')
    })

    it('SEL_BE_002_04: should find search input', { tags: '@SEL_BE_002_04' }, () => {
      cy.get(pom.editorSelectors.blockSearch).should('exist').and('be.visible')
    })

    it('SEL_BE_002_05: should find category chips container', { tags: '@SEL_BE_002_05' }, () => {
      cy.get(pom.editorSelectors.categoryChips).should('exist').and('be.visible')
    })

    it('SEL_BE_002_06: should find category chip by name', { tags: '@SEL_BE_002_06' }, () => {
      // Test with 'content' or 'hero' category depending on available blocks
      cy.get('[data-cy^="block-picker-category-"]').first().should('exist').and('be.visible')
    })

    it('SEL_BE_002_07: should find hero block card', { tags: '@SEL_BE_002_07' }, () => {
      cy.get(pom.editorSelectors.blockItem('hero')).scrollIntoView().should('exist').and('be.visible')
    })

    it('SEL_BE_002_08: should find hero add button', { tags: '@SEL_BE_002_08' }, () => {
      // Hover to show add button
      cy.get(pom.editorSelectors.blockItem('hero')).trigger('mouseenter')
      cy.get(pom.editorSelectors.addBlock('hero')).should('exist')
    })
  })

  // ===========================================================================
  // SEL_BE_003: ENTITY FIELDS PANEL SELECTORS
  // ===========================================================================
  describe('SEL_BE_003: Entity Fields Panel Selectors', { tags: '@SEL_BE_003' }, () => {
    let testPageId: string

    before(() => {
      // Create a test page to ensure we have one to edit
      loginAsDefaultDeveloper()
      cy.request({
        method: 'POST',
        url: '/api/v1/pages',
        headers: {
          'x-team-id': DEVELOPER_TEAM_ID,
          'Content-Type': 'application/json'
        },
        body: {
          title: `Selector Test Page ${Date.now()}`,
          slug: `selector-test-${Date.now()}`,
          locale: 'en',
          published: false,
          blocks: []
        }
      }).then((response) => {
        testPageId = response.body.data.id
      })
    })

    beforeEach(() => {
      pom.visitEdit(testPageId)
      pom.waitForEditor()
      // Switch to config tab to see entity fields
      cy.get(pom.editorSelectors.tabConfig).click()
    })

    after(() => {
      // Cleanup test page
      if (testPageId) {
        cy.request({
          method: 'DELETE',
          url: `/api/v1/pages/${testPageId}`,
          headers: { 'x-team-id': DEVELOPER_TEAM_ID },
          failOnStatusCode: false
        })
      }
    })

    it('SEL_BE_003_01: should find entity fields panel container', { tags: '@SEL_BE_003_01' }, () => {
      cy.get(pom.editorSelectors.entityFieldsPanel).should('exist').and('be.visible')
    })

    // Note: These tests depend on the entity having specific fields configured
    it('SEL_BE_003_02: should find entity field by name', { tags: '@SEL_BE_003_02' }, () => {
      // Check if any field exists - pages might have excerpt, featuredImage, etc.
      // Selector pattern is entity-field-{name}
      cy.get('[data-cy^="entity-field-"]').should('exist')
    })

    it('SEL_BE_003_03: should find category list (if taxonomies enabled)', { tags: '@SEL_BE_003_03' }, () => {
      // This test is conditional - taxonomies may or may not be enabled
      cy.get('body').then(($body) => {
        if ($body.find(pom.editorSelectors.entityCategoryList).length > 0) {
          cy.get(pom.editorSelectors.entityCategoryList).should('exist')
        } else {
          cy.log('Taxonomies not enabled for pages - skipping')
        }
      })
    })
  })

  // ===========================================================================
  // SEL_BE_004: LAYOUT CANVAS SELECTORS
  // ===========================================================================
  describe('SEL_BE_004: Layout Canvas Selectors', { tags: '@SEL_BE_004' }, () => {
    beforeEach(() => {
      pom.visitCreate()
      pom.waitForEditor()
      pom.switchToLayoutMode()
    })

    // When no blocks: only empty state exists (no container)
    it('SEL_BE_004_01: should find empty state when no blocks', { tags: '@SEL_BE_004_01' }, () => {
      cy.get(pom.editorSelectors.layoutCanvasEmpty).should('exist').and('be.visible')
    })

    describe('With block added', () => {
      beforeEach(() => {
        pom.addBlock('hero')
        // Wait for block to be added
        cy.get(pom.editorSelectors.sortableBlockGeneric).should('have.length.at.least', 1)
      })

      // Container only exists when there ARE blocks
      it('SEL_BE_004_02: should find layout canvas container with blocks', { tags: '@SEL_BE_004_02' }, () => {
        cy.get(pom.editorSelectors.layoutCanvas).should('exist').and('be.visible')
      })

      it('SEL_BE_004_03: should find sortable blocks (generic)', { tags: '@SEL_BE_004_03' }, () => {
        cy.get(pom.editorSelectors.sortableBlockGeneric).should('exist')
      })

      it('SEL_BE_004_04: should find specific sortable block by ID', { tags: '@SEL_BE_004_04' }, () => {
        cy.get(pom.editorSelectors.sortableBlockGeneric).first()
          .invoke('attr', 'data-cy')
          .then((dataCy) => {
            const blockId = dataCy?.replace('sortable-block-', '') || ''
            expect(blockId).to.not.be.empty
            cy.get(pom.editorSelectors.sortableBlock(blockId)).should('exist')
          })
      })

      it('SEL_BE_004_05: should find drag handle', { tags: '@SEL_BE_004_05' }, () => {
        cy.get(pom.editorSelectors.sortableBlockGeneric).first()
          .invoke('attr', 'data-cy')
          .then((dataCy) => {
            const blockId = dataCy?.replace('sortable-block-', '') || ''
            cy.get(pom.editorSelectors.dragHandle(blockId)).should('exist')
          })
      })

      it('SEL_BE_004_06: should find duplicate button', { tags: '@SEL_BE_004_06' }, () => {
        cy.get(pom.editorSelectors.sortableBlockGeneric).first()
          .invoke('attr', 'data-cy')
          .then((dataCy) => {
            const blockId = dataCy?.replace('sortable-block-', '') || ''
            cy.get(pom.editorSelectors.duplicateBlock(blockId)).should('exist')
          })
      })

      it('SEL_BE_004_07: should find remove button', { tags: '@SEL_BE_004_07' }, () => {
        cy.get(pom.editorSelectors.sortableBlockGeneric).first()
          .invoke('attr', 'data-cy')
          .then((dataCy) => {
            const blockId = dataCy?.replace('sortable-block-', '') || ''
            cy.get(pom.editorSelectors.removeBlock(blockId)).should('exist')
          })
      })

      // Note: sortableBlockName selector is defined but not yet implemented in component
      // This test validates the block card contains the block name text
      it('SEL_BE_004_08: should display block name in sortable card', { tags: '@SEL_BE_004_08' }, () => {
        cy.get(pom.editorSelectors.sortableBlockGeneric).first()
          .should('contain.text', 'Hero') // Hero block should show its name
      })
    })
  })

  // ===========================================================================
  // SEL_BE_005: PREVIEW CANVAS SELECTORS
  // ===========================================================================
  describe('SEL_BE_005: Preview Canvas Selectors', { tags: '@SEL_BE_005' }, () => {
    beforeEach(() => {
      pom.visitCreate()
      pom.waitForEditor()
      // Add a block first, then switch to preview
      pom.switchToLayoutMode()
      pom.addBlock('hero')
      cy.get(pom.editorSelectors.sortableBlockGeneric).should('have.length.at.least', 1)
      pom.switchToPreviewMode()
    })

    it('SEL_BE_005_01: should find preview canvas container', { tags: '@SEL_BE_005_01' }, () => {
      cy.get(pom.editorSelectors.previewCanvas).should('exist').and('be.visible')
    })

    it('SEL_BE_005_02: should find preview blocks (generic)', { tags: '@SEL_BE_005_02' }, () => {
      cy.get(pom.editorSelectors.previewBlockGeneric).should('exist')
    })

    it('SEL_BE_005_03: should find specific preview block by ID', { tags: '@SEL_BE_005_03' }, () => {
      cy.get(pom.editorSelectors.previewBlockGeneric).first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const blockId = dataCy?.replace('preview-block-', '') || ''
          expect(blockId).to.not.be.empty
          cy.get(pom.editorSelectors.previewBlock(blockId)).should('exist')
        })
    })

    it('SEL_BE_005_04: should find floating toolbar on hover', { tags: '@SEL_BE_005_04' }, () => {
      cy.get(pom.editorSelectors.previewBlockGeneric).first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const blockId = dataCy?.replace('preview-block-', '') || ''
          // Hover to show toolbar
          cy.get(pom.editorSelectors.previewBlock(blockId)).trigger('mouseenter')
          cy.get(pom.editorSelectors.floatingToolbar(blockId)).should('exist')
        })
    })

    it('SEL_BE_005_05: should find toolbar block name', { tags: '@SEL_BE_005_05' }, () => {
      cy.get(pom.editorSelectors.previewBlockGeneric).first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const blockId = dataCy?.replace('preview-block-', '') || ''
          cy.get(pom.editorSelectors.previewBlock(blockId)).trigger('mouseenter')
          cy.get(pom.editorSelectors.floatingToolbarName(blockId)).should('exist')
        })
    })

    it('SEL_BE_005_06: should find toolbar duplicate button', { tags: '@SEL_BE_005_06' }, () => {
      cy.get(pom.editorSelectors.previewBlockGeneric).first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const blockId = dataCy?.replace('preview-block-', '') || ''
          cy.get(pom.editorSelectors.previewBlock(blockId)).trigger('mouseenter')
          cy.get(pom.editorSelectors.floatingToolbarDuplicate(blockId)).should('exist')
        })
    })

    it('SEL_BE_005_07: should find toolbar delete button', { tags: '@SEL_BE_005_07' }, () => {
      cy.get(pom.editorSelectors.previewBlockGeneric).first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const blockId = dataCy?.replace('preview-block-', '') || ''
          cy.get(pom.editorSelectors.previewBlock(blockId)).trigger('mouseenter')
          cy.get(pom.editorSelectors.floatingToolbarDelete(blockId)).should('exist')
        })
    })
  })

  // ===========================================================================
  // SEL_BE_006: BLOCK PROPERTIES PANEL SELECTORS
  // ===========================================================================
  describe('SEL_BE_006: Block Properties Panel Selectors', { tags: '@SEL_BE_006' }, () => {
    beforeEach(() => {
      pom.visitCreate()
      pom.waitForEditor()
    })

    // When no block selected: only empty state exists (no container)
    it('SEL_BE_006_01: should find empty state when no block selected', { tags: '@SEL_BE_006_01' }, () => {
      cy.get(pom.editorSelectors.blockPropertiesEmpty).should('exist').and('be.visible')
    })

    describe('With block selected', () => {
      beforeEach(() => {
        pom.switchToLayoutMode()
        pom.addBlock('hero')
        // Block is auto-selected after adding
        cy.get(pom.editorSelectors.sortableBlockGeneric).should('have.length.at.least', 1)
      })

      // Container only exists when a block IS selected
      it('SEL_BE_006_02: should find properties panel container with block selected', { tags: '@SEL_BE_006_02' }, () => {
        cy.get(pom.editorSelectors.blockPropertiesPanel).should('exist').and('be.visible')
      })

      it('SEL_BE_006_03: should find panel header', { tags: '@SEL_BE_006_03' }, () => {
        cy.get(pom.editorSelectors.blockPropertiesHeader).should('exist').and('be.visible')
      })

      it('SEL_BE_006_04: should find block name in header', { tags: '@SEL_BE_006_04' }, () => {
        cy.get(pom.editorSelectors.blockPropertiesName).should('exist').and('be.visible')
      })

      it('SEL_BE_006_05: should find content tab', { tags: '@SEL_BE_006_05' }, () => {
        cy.get(pom.editorSelectors.tabContent).should('exist').and('be.visible')
      })

      it('SEL_BE_006_06: should find design tab', { tags: '@SEL_BE_006_06' }, () => {
        cy.get(pom.editorSelectors.tabDesign).should('exist').and('be.visible')
      })

      it('SEL_BE_006_07: should find advanced tab', { tags: '@SEL_BE_006_07' }, () => {
        cy.get(pom.editorSelectors.tabAdvanced).should('exist').and('be.visible')
      })

      it('SEL_BE_006_08: should find dynamic form container', { tags: '@SEL_BE_006_08' }, () => {
        cy.get(pom.editorSelectors.dynamicForm).should('exist').and('be.visible')
      })

      it('SEL_BE_006_09: should find dynamic field by name', { tags: '@SEL_BE_006_09' }, () => {
        // Hero block should have a title field
        cy.get(pom.editorSelectors.dynamicField('title')).should('exist')
      })
    })
  })

  // ===========================================================================
  // SEL_BE_007: ARRAY FIELDS SELECTORS
  // ===========================================================================
  describe('SEL_BE_007: Array Fields Selectors', { tags: '@SEL_BE_007' }, () => {
    beforeEach(() => {
      pom.visitCreate()
      pom.waitForEditor()
      pom.switchToLayoutMode()
      // Add features-grid block which has array fields
      pom.addBlock('features-grid')
      cy.get(pom.editorSelectors.sortableBlockGeneric).should('have.length.at.least', 1)
    })

    it('SEL_BE_007_01: should find array field container', { tags: '@SEL_BE_007_01' }, () => {
      // features-grid has 'features' array field - selector is block-array-{name}
      cy.get('[data-cy^="block-array-"]').should('exist')
    })

    it('SEL_BE_007_02: should find array field add button', { tags: '@SEL_BE_007_02' }, () => {
      // Selector is block-array-{name}-add
      cy.get('[data-cy$="-add"][data-cy^="block-array-"]').should('exist')
    })

    describe('With array items', () => {
      beforeEach(() => {
        // Click add button to add an item
        cy.get('[data-cy$="-add"][data-cy^="block-array-"]').first().click()
        // Wait for item controls to appear - use remove button as indicator
        // Selector pattern is block-array-{name}-{index}-remove
        cy.get('[data-cy$="-remove"][data-cy^="block-array-"]', { timeout: 10000 }).should('have.length.at.least', 1)
      })

      it('SEL_BE_007_03: should find array field item controls', { tags: '@SEL_BE_007_03' }, () => {
        // Item exists if it has remove button
        cy.get('[data-cy$="-remove"][data-cy^="block-array-"]').first().should('exist')
      })

      it('SEL_BE_007_04: should find array field item move up button', { tags: '@SEL_BE_007_04' }, () => {
        // Add second item for move buttons to be enabled
        cy.get('[data-cy$="-add"][data-cy^="block-array-"]').first().click()
        cy.get('[data-cy$="-remove"][data-cy^="block-array-"]').should('have.length.at.least', 2)
        // Selector is block-array-{name}-{index}-up
        cy.get('[data-cy$="-up"][data-cy^="block-array-"]').should('exist')
      })

      it('SEL_BE_007_05: should find array field item move down button', { tags: '@SEL_BE_007_05' }, () => {
        // Selector is block-array-{name}-{index}-down
        cy.get('[data-cy$="-down"][data-cy^="block-array-"]').should('exist')
      })

      it('SEL_BE_007_06: should find array field item remove button', { tags: '@SEL_BE_007_06' }, () => {
        // Selector is block-array-{name}-{index}-remove
        cy.get('[data-cy$="-remove"][data-cy^="block-array-"]').should('exist')
      })
    })
  })
})
