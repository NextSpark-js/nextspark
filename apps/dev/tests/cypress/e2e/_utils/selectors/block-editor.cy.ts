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
 * - SEL_BE_008: Patterns Tab Selectors
 * - SEL_BE_009: Pattern Reference Selectors
 *
 * Re-execution:
 *   pnpm tags @SEL_BE_001        # Run only Header tests
 *   pnpm tags @SEL_BE_004        # Run only Layout Canvas tests
 *   pnpm tags @SEL_BE_008        # Run only Patterns Tab tests
 *   pnpm tags @patterns          # Run all patterns-related tests
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

    it('SEL_BE_001_06: should find settings mode button (viewSettings)', { tags: '@SEL_BE_001_06' }, () => {
      // v2.0: viewEditor renamed to viewSettings
      cy.get(pom.editorSelectors.viewSettings).should('exist').and('be.visible')
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

    it('SEL_BE_002_03: should find layout tab', { tags: '@SEL_BE_002_03' }, () => {
      // v2.0: tabConfig replaced by tabLayout (tree view)
      // Entity fields moved to Settings mode in center column
      cy.get(pom.editorSelectors.tabLayout).should('exist').and('be.visible')
    })

    it('SEL_BE_002_04: should find search input', { tags: '@SEL_BE_002_04' }, () => {
      cy.get(pom.editorSelectors.blockSearch).should('exist').and('be.visible')
    })

    it('SEL_BE_002_05: should find category chips container', { tags: '@SEL_BE_002_05' }, () => {
      cy.get(pom.editorSelectors.categoryChips).should('exist').and('be.visible')
    })

    it('SEL_BE_002_06: should find category chip by name', { tags: '@SEL_BE_002_06' }, () => {
      // Test with 'content' or 'hero' category depending on available blocks
      cy.get(pom.editorSelectors.categoryGeneric).first().should('exist').and('be.visible')
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
      // v2.0: Switch to Settings mode to see entity fields (moved to center column)
      cy.get(pom.editorSelectors.viewSettings).click()
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

    it('SEL_BE_003_01: should find entity fields section container', { tags: '@SEL_BE_003_01' }, () => {
      // v2.0: Entity fields moved to configPanel.entityFieldsSection in Settings mode
      cy.get(pom.editorSelectors.configEntitySection).should('exist').and('be.visible')
    })

    // Note: These tests depend on the entity having specific fields configured
    it('SEL_BE_003_02: should find entity field by name', { tags: '@SEL_BE_003_02' }, () => {
      // v2.0: Selector pattern is builder-config-entity-field-{name}
      cy.get('[data-cy^="builder-config-entity-field-"]').should('exist')
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
  // SEL_BE_004: TREE VIEW SELECTORS (v2.0 - Layout tab)
  // NOTE: layoutCanvas is deprecated in v2.0. Block list is now in treeView (Layout tab).
  // ===========================================================================
  describe('SEL_BE_004: Tree View Selectors (Layout Tab)', { tags: '@SEL_BE_004' }, () => {
    beforeEach(() => {
      pom.visitCreate()
      pom.waitForEditor()
      // v2.0: Click Layout tab in left sidebar to see tree view
      cy.get(pom.editorSelectors.tabLayout).click()
    })

    // When no blocks: empty state in tree view
    it('SEL_BE_004_01: should find empty state when no blocks', { tags: '@SEL_BE_004_01' }, () => {
      cy.get(pom.editorSelectors.treeViewEmpty).should('exist').and('be.visible')
    })

    describe('With block added', () => {
      beforeEach(() => {
        // Switch to Blocks tab to add a block
        cy.get(pom.editorSelectors.tabBlocks).click()
        pom.addBlock('hero')
        // Switch back to Layout tab
        cy.get(pom.editorSelectors.tabLayout).click()
        // Wait for tree view to show the block
        cy.get(pom.editorSelectors.treeView).should('exist')
      })

      // Tree view container exists when there ARE blocks
      it('SEL_BE_004_02: should find tree view container with blocks', { tags: '@SEL_BE_004_02' }, () => {
        cy.get(pom.editorSelectors.treeView).should('exist').and('be.visible')
      })

      // Test preview canvas has blocks (v2.0: blocks render in preview mode)
      it('SEL_BE_004_03: should find preview blocks (generic)', { tags: '@SEL_BE_004_03' }, () => {
        // Preview canvas is visible by default in v2.0
        cy.get(pom.editorSelectors.previewBlockGeneric).should('exist')
      })

      it('SEL_BE_004_04: should find specific preview block by ID', { tags: '@SEL_BE_004_04' }, () => {
        cy.get(pom.editorSelectors.previewBlockGeneric).first()
          .invoke('attr', 'data-cy')
          .then((dataCy) => {
            const blockId = dataCy?.replace('preview-block-', '') || ''
            expect(blockId).to.not.be.empty
            cy.get(pom.editorSelectors.previewBlock(blockId)).should('exist')
          })
      })

      it('SEL_BE_004_05: should find floating toolbar drag handle on hover', { tags: '@SEL_BE_004_05' }, () => {
        cy.get(pom.editorSelectors.previewBlockGeneric).first()
          .invoke('attr', 'data-cy')
          .then((dataCy) => {
            const blockId = dataCy?.replace('preview-block-', '') || ''
            cy.get(pom.editorSelectors.previewBlock(blockId)).trigger('mouseenter')
            cy.get(pom.editorSelectors.floatingToolbarDrag(blockId)).should('exist')
          })
      })

      it('SEL_BE_004_06: should find floating toolbar duplicate button', { tags: '@SEL_BE_004_06' }, () => {
        cy.get(pom.editorSelectors.previewBlockGeneric).first()
          .invoke('attr', 'data-cy')
          .then((dataCy) => {
            const blockId = dataCy?.replace('preview-block-', '') || ''
            cy.get(pom.editorSelectors.previewBlock(blockId)).trigger('mouseenter')
            cy.get(pom.editorSelectors.floatingToolbarDuplicate(blockId)).should('exist')
          })
      })

      it('SEL_BE_004_07: should find floating toolbar delete button', { tags: '@SEL_BE_004_07' }, () => {
        cy.get(pom.editorSelectors.previewBlockGeneric).first()
          .invoke('attr', 'data-cy')
          .then((dataCy) => {
            const blockId = dataCy?.replace('preview-block-', '') || ''
            cy.get(pom.editorSelectors.previewBlock(blockId)).trigger('mouseenter')
            cy.get(pom.editorSelectors.floatingToolbarDelete(blockId)).should('exist')
          })
      })

      it('SEL_BE_004_08: should display block name in floating toolbar', { tags: '@SEL_BE_004_08' }, () => {
        cy.get(pom.editorSelectors.previewBlockGeneric).first()
          .invoke('attr', 'data-cy')
          .then((dataCy) => {
            const blockId = dataCy?.replace('preview-block-', '') || ''
            cy.get(pom.editorSelectors.previewBlock(blockId)).trigger('mouseenter')
            cy.get(pom.editorSelectors.floatingToolbarName(blockId)).should('contain.text', 'Hero')
          })
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
      // v2.0: Preview mode is the default, just add a block
      pom.addBlock('hero')
      // Wait for block to render in preview canvas
      cy.get(pom.editorSelectors.previewBlockGeneric).should('have.length.at.least', 1)
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
        // v2.0: Add block (auto-selected) in Preview mode
        pom.addBlock('hero')
        // Block is auto-selected after adding - wait for it in preview canvas
        cy.get(pom.editorSelectors.previewBlockGeneric).should('have.length.at.least', 1)
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
      // v2.0: Add features-grid block which has array fields
      pom.addBlock('features-grid')
      // Wait for block in preview canvas (v2.0 - preview mode is default)
      cy.get(pom.editorSelectors.previewBlockGeneric).should('have.length.at.least', 1)
    })

    it('SEL_BE_007_01: should find array field container', { tags: '@SEL_BE_007_01' }, () => {
      // features-grid has 'features' array field - selector is block-array-{name}
      cy.get(pom.editorSelectors.arrayFieldGeneric).should('exist')
    })

    it('SEL_BE_007_02: should find array field add button', { tags: '@SEL_BE_007_02' }, () => {
      // Selector is block-array-{name}-add
      cy.get(pom.editorSelectors.arrayFieldAddGeneric).should('exist')
    })

    describe('With array items', () => {
      beforeEach(() => {
        // Click add button to add an item
        cy.get(pom.editorSelectors.arrayFieldAddGeneric).first().click()
        // Wait for item controls to appear - use remove button as indicator
        // Selector pattern is block-array-{name}-{index}-remove
        cy.get(pom.editorSelectors.arrayFieldRemoveGeneric, { timeout: 10000 }).should('have.length.at.least', 1)
      })

      it('SEL_BE_007_03: should find array field item controls', { tags: '@SEL_BE_007_03' }, () => {
        // Item exists if it has remove button
        cy.get(pom.editorSelectors.arrayFieldRemoveGeneric).first().should('exist')
      })

      it('SEL_BE_007_04: should find array field item move up button', { tags: '@SEL_BE_007_04' }, () => {
        // Add second item for move buttons to be enabled
        cy.get(pom.editorSelectors.arrayFieldAddGeneric).first().click()
        cy.get(pom.editorSelectors.arrayFieldRemoveGeneric).should('have.length.at.least', 2)
        // Selector is block-array-{name}-{index}-up
        cy.get(pom.editorSelectors.arrayFieldUpGeneric).should('exist')
      })

      it('SEL_BE_007_05: should find array field item move down button', { tags: '@SEL_BE_007_05' }, () => {
        // Selector is block-array-{name}-{index}-down
        cy.get(pom.editorSelectors.arrayFieldDownGeneric).should('exist')
      })

      it('SEL_BE_007_06: should find array field item remove button', { tags: '@SEL_BE_007_06' }, () => {
        // Selector is block-array-{name}-{index}-remove
        cy.get(pom.editorSelectors.arrayFieldRemoveGeneric).should('exist')
      })
    })
  })

  // ===========================================================================
  // SEL_BE_008: PATTERNS TAB SELECTORS
  // ===========================================================================
  describe('SEL_BE_008: Patterns Tab Selectors', { tags: ['@SEL_BE_008', '@patterns'] }, () => {
    beforeEach(() => {
      pom.visitCreate()
      pom.waitForEditor()
    })

    it('SEL_BE_008_01: should find patterns tab button', { tags: '@SEL_BE_008_01' }, () => {
      cy.get(pom.editorSelectors.tabPatterns).should('exist').and('be.visible')
    })

    it('SEL_BE_008_02: should find patterns search input after clicking patterns tab', { tags: '@SEL_BE_008_02' }, () => {
      cy.get(pom.editorSelectors.tabPatterns).click()
      cy.get(pom.editorSelectors.patternsSearch).should('exist').and('be.visible')
    })

    it('SEL_BE_008_03: should find patterns list container', { tags: '@SEL_BE_008_03' }, () => {
      cy.get(pom.editorSelectors.tabPatterns).click()
      cy.get(pom.editorSelectors.patternsList).should('exist').and('be.visible')
    })

    it('SEL_BE_008_04: should find pattern cards for sample patterns', { tags: '@SEL_BE_008_04' }, () => {
      cy.get(pom.editorSelectors.tabPatterns).click()
      // Wait for patterns to load
      cy.wait(500)
      // Check for pattern cards with specific IDs (using generic selector)
      // Pattern cards should exist for published patterns
      cy.get(pom.editorSelectors.patternCardGeneric).should('have.length.at.least', 1)
    })

    it('SEL_BE_008_05: should find pattern card icon element', { tags: '@SEL_BE_008_05' }, () => {
      cy.get(pom.editorSelectors.tabPatterns).click()
      cy.wait(500)
      // Get first pattern ID and use dynamic selector
      cy.get(pom.editorSelectors.patternCardGeneric).first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const id = dataCy?.replace('block-picker-pattern-card-', '') || ''
          cy.get(pom.editorSelectors.patternCardIcon(id)).should('exist')
        })
    })

    it('SEL_BE_008_06: should find pattern card title element', { tags: '@SEL_BE_008_06' }, () => {
      cy.get(pom.editorSelectors.tabPatterns).click()
      cy.wait(500)
      // Get first pattern ID and use dynamic selector
      cy.get(pom.editorSelectors.patternCardGeneric).first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const id = dataCy?.replace('block-picker-pattern-card-', '') || ''
          cy.get(pom.editorSelectors.patternCardTitle(id)).should('exist')
        })
    })

    it('SEL_BE_008_07: should find pattern card description element', { tags: '@SEL_BE_008_07' }, () => {
      cy.get(pom.editorSelectors.tabPatterns).click()
      cy.wait(500)
      // Get first pattern ID and use dynamic selector
      cy.get(pom.editorSelectors.patternCardGeneric).first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const id = dataCy?.replace('block-picker-pattern-card-', '') || ''
          cy.get(pom.editorSelectors.patternCardDescription(id)).should('exist')
        })
    })

    it('SEL_BE_008_08: should find pattern card insert button', { tags: '@SEL_BE_008_08' }, () => {
      cy.get(pom.editorSelectors.tabPatterns).click()
      cy.wait(500)
      // Get first pattern ID and use dynamic selector
      cy.get(pom.editorSelectors.patternCardGeneric).first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const id = dataCy?.replace('block-picker-pattern-card-', '') || ''
          cy.get(pom.editorSelectors.patternCardInsertButton(id)).should('exist')
        })
    })
  })

  // ===========================================================================
  // SEL_BE_009: PATTERN REFERENCE SELECTORS
  // ===========================================================================
  describe('SEL_BE_009: Pattern Reference Selectors', { tags: ['@SEL_BE_009', '@patterns'] }, () => {
    let patternRefId: string

    beforeEach(() => {
      pom.visitCreate()
      pom.waitForEditor()
      pom.switchToLayoutMode()

      // Insert a pattern to create a pattern reference
      cy.get(pom.editorSelectors.tabPatterns).click()
      cy.wait(500)

      // Click insert on first available pattern
      cy.get(pom.editorSelectors.patternCardGeneric).first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const id = dataCy?.replace('block-picker-pattern-card-', '') || ''
          cy.get(pom.editorSelectors.patternCardInsertButton(id)).click()
        })

      // Wait for pattern reference to be created
      cy.wait(1000)

      // Switch to preview mode to see pattern reference rendering
      pom.switchToPreviewMode()

      // Get the pattern reference ID from the first pattern-reference element
      cy.get(pom.editorSelectors.patternReferenceGeneric).first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          patternRefId = dataCy?.replace('pattern-reference-', '') || ''
          cy.log(`Pattern reference ID: ${patternRefId}`)
        })
    })

    it('SEL_BE_009_01: should find pattern reference container', { tags: '@SEL_BE_009_01' }, () => {
      cy.get(pom.editorSelectors.patternReferenceGeneric).should('exist').and('be.visible')
    })

    it('SEL_BE_009_02: should find pattern reference badge', { tags: '@SEL_BE_009_02' }, () => {
      // Get ref from first pattern-reference, then use dynamic selector
      cy.get(pom.editorSelectors.patternReferenceGeneric).first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const ref = dataCy?.replace('pattern-reference-', '') || ''
          cy.get(pom.editorSelectors.patternReferenceBadge(ref)).should('exist')
        })
    })

    it('SEL_BE_009_03: should find pattern reference remove button', { tags: '@SEL_BE_009_03' }, () => {
      // Get ref from first pattern-reference, then use dynamic selector
      cy.get(pom.editorSelectors.patternReferenceGeneric).first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const ref = dataCy?.replace('pattern-reference-', '') || ''
          cy.get(pom.editorSelectors.patternReferenceRemove(ref)).should('exist')
        })
    })

    it.skip('SEL_BE_009_04: should find pattern reference locked state when selected', { tags: '@SEL_BE_009_04' }, () => {
      // SKIPPED: patternReferenceLocked selector is defined in core but not yet implemented in component
      // TODO: Implement locked state visual indicator for pattern references
      cy.get(pom.editorSelectors.patternReferenceGeneric).first().click()
      cy.wait(500)
      cy.get(pom.editorSelectors.patternReferenceGeneric).first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const ref = dataCy?.replace('pattern-reference-', '') || ''
          cy.get(pom.editorSelectors.patternReferenceLocked(ref)).should('exist')
        })
    })

    it('SEL_BE_009_05: should find pattern reference edit link', { tags: '@SEL_BE_009_05' }, () => {
      // Get ref from first pattern-reference, then use dynamic selector
      cy.get(pom.editorSelectors.patternReferenceGeneric).first()
        .invoke('attr', 'data-cy')
        .then((dataCy) => {
          const ref = dataCy?.replace('pattern-reference-', '') || ''
          cy.get(pom.editorSelectors.patternReferenceEditLink(ref)).should('exist')
        })
    })
  })

  // ===========================================================================
  // SEL_BE_010: CONFIG PANEL SEO & CUSTOM FIELDS SELECTORS (v2.1)
  // ===========================================================================
  describe('SEL_BE_010: Config Panel SEO & Custom Fields Selectors', { tags: '@SEL_BE_010' }, () => {
    let testPageId: string

    before(() => {
      loginAsDefaultDeveloper()
      cy.request({
        method: 'POST',
        url: '/api/v1/pages',
        headers: {
          'x-team-id': DEVELOPER_TEAM_ID,
          'Content-Type': 'application/json'
        },
        body: {
          title: `SEO Test Page ${Date.now()}`,
          slug: `seo-test-${Date.now()}`,
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
      cy.get(pom.editorSelectors.viewSettings).click()
    })

    after(() => {
      if (testPageId) {
        cy.request({
          method: 'DELETE',
          url: `/api/v1/pages/${testPageId}`,
          headers: { 'x-team-id': DEVELOPER_TEAM_ID },
          failOnStatusCode: false
        })
      }
    })

    // SEO Section tests
    describe('SEO Section', () => {
      it('SEL_BE_010_01: should find SEO section container', { tags: '@SEL_BE_010_01' }, () => {
        cy.get(pom.editorSelectors.configSeoSectionContainer).should('exist').and('be.visible')
      })

      it('SEL_BE_010_02: should find SEO section trigger', { tags: '@SEL_BE_010_02' }, () => {
        cy.get(pom.editorSelectors.configSeoSectionTrigger).should('exist').and('be.visible')
      })

      it('SEL_BE_010_03: should find SEO section content after click', { tags: '@SEL_BE_010_03' }, () => {
        cy.get(pom.editorSelectors.configSeoSectionTrigger).click()
        cy.get(pom.editorSelectors.configSeoSectionContent).should('exist').and('be.visible')
      })

      it('SEL_BE_010_04: should find meta title input', { tags: '@SEL_BE_010_04' }, () => {
        cy.get(pom.editorSelectors.configSeoSectionTrigger).click()
        cy.get(pom.editorSelectors.configSeoMetaTitle).should('exist').and('be.visible')
      })

      it('SEL_BE_010_05: should find meta description input', { tags: '@SEL_BE_010_05' }, () => {
        cy.get(pom.editorSelectors.configSeoSectionTrigger).click()
        cy.get(pom.editorSelectors.configSeoMetaDescription).should('exist').and('be.visible')
      })

      it('SEL_BE_010_06: should find meta keywords input', { tags: '@SEL_BE_010_06' }, () => {
        cy.get(pom.editorSelectors.configSeoSectionTrigger).click()
        cy.get(pom.editorSelectors.configSeoMetaKeywords).should('exist').and('be.visible')
      })

      it('SEL_BE_010_07: should find OG image input', { tags: '@SEL_BE_010_07' }, () => {
        cy.get(pom.editorSelectors.configSeoSectionTrigger).click()
        cy.get(pom.editorSelectors.configSeoOgImage).should('exist').and('be.visible')
      })
    })

    // Custom Fields Section tests
    describe('Custom Fields Section', () => {
      it('SEL_BE_010_08: should find custom fields section container', { tags: '@SEL_BE_010_08' }, () => {
        cy.get(pom.editorSelectors.configCustomFieldsContainer).should('exist').and('be.visible')
      })

      it('SEL_BE_010_09: should find custom fields section trigger', { tags: '@SEL_BE_010_09' }, () => {
        cy.get(pom.editorSelectors.configCustomFieldsTrigger).should('exist').and('be.visible')
      })

      it('SEL_BE_010_10: should find custom fields content after click', { tags: '@SEL_BE_010_10' }, () => {
        cy.get(pom.editorSelectors.configCustomFieldsTrigger).click()
        cy.get(pom.editorSelectors.configCustomFieldsContent).should('exist').and('be.visible')
      })

      it('SEL_BE_010_11: should find add custom field button', { tags: '@SEL_BE_010_11' }, () => {
        cy.get(pom.editorSelectors.configCustomFieldsTrigger).click()
        cy.get(pom.editorSelectors.configCustomFieldsAddBtn).should('exist').and('be.visible')
      })

      describe('With custom field added', () => {
        beforeEach(() => {
          cy.get(pom.editorSelectors.configCustomFieldsTrigger).click()
          cy.get(pom.editorSelectors.configCustomFieldsAddBtn).click()
        })

        it('SEL_BE_010_12: should find custom field key input', { tags: '@SEL_BE_010_12' }, () => {
          cy.get(pom.editorSelectors.configCustomFieldKey(0)).should('exist').and('be.visible')
        })

        it('SEL_BE_010_13: should find custom field value input', { tags: '@SEL_BE_010_13' }, () => {
          cy.get(pom.editorSelectors.configCustomFieldValue(0)).should('exist').and('be.visible')
        })

        it('SEL_BE_010_14: should find custom field remove button', { tags: '@SEL_BE_010_14' }, () => {
          cy.get(pom.editorSelectors.configCustomFieldRemove(0)).should('exist').and('be.visible')
        })
      })
    })
  })
})
