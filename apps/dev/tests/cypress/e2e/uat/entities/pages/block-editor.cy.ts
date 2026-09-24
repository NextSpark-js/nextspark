/// <reference types="cypress" />

/**
 * Block Editor - Admin UI Tests
 *
 * Tests for the block editor interface including block picker,
 * canvas, settings panel, and mode switching.
 *
 * Tags: @uat, @feat-pages, @block-editor, @page-builder, @regression
 */

import * as allure from 'allure-cypress'
import { PageBuilderPOM, loginAsOwner } from '../../../../src'

// Team ID for logged-in user (carlos.mendoza is owner of team-everpoint-001)
const OWNER_TEAM_ID = 'team-everpoint-001'

describe('Block Editor - Admin UI', {
  tags: ['@uat', '@feat-pages', '@block-editor', '@page-builder', '@regression']
}, () => {
  let testPageId: string

  beforeEach(() => {
    allure.epic('Page Builder')
    allure.feature('Block Editor')

    // Setup API intercepts BEFORE login
    PageBuilderPOM.setupApiIntercepts()
    loginAsOwner()

    // Visit dashboard first to ensure session cookies are active
    cy.visit('/dashboard', { timeout: 30000 })
    cy.url().should('include', '/dashboard')

    // Create a test page for each test via session auth
    // x-team-id header is required by API even with session auth
    const timestamp = Date.now()
    cy.request({
      method: 'POST',
      url: '/api/v1/pages',
      headers: {
        'x-team-id': OWNER_TEAM_ID,
        'Content-Type': 'application/json'
      },
      body: {
        title: `Editor Test ${timestamp}`,
        slug: `editor-test-${timestamp}`,
        locale: 'en',
        published: false,
        blocks: []
      }
    }).then((response) => {
      testPageId = response.body.data.id
    })
  })

  afterEach(() => {
    // Cleanup test page
    if (testPageId) {
      cy.request({
        method: 'DELETE',
        url: `/api/v1/pages/${testPageId}`,
        headers: {
          'x-team-id': OWNER_TEAM_ID
        },
        failOnStatusCode: false
      })
    }
  })

  // ============================================================
  // Editor Load Tests
  // ============================================================
  describe('Editor Loading', () => {
    it('PB-EDITOR-001: Should open editor for existing page', { tags: ['@smoke'] }, () => {
      allure.story('Editor Loading')
      allure.severity('critical')

      cy.then(() => {
        PageBuilderPOM.visitEdit(testPageId)
        PageBuilderPOM.waitForEditorLoad()
        PageBuilderPOM.assertEditorVisible()

        cy.log('Editor loaded successfully')
      })
    })

    it('PB-EDITOR-002: Should open new page form', () => {
      allure.story('Editor Loading')
      allure.severity('normal')

      cy.visit('/dashboard/pages/create')

      // Use correct selectors from dashboard.json blockEditor section
      cy.get('[data-cy="builder-editor"]', { timeout: 15000 }).should('be.visible')
      cy.get('[data-cy="editor-title-input"]').should('be.visible')
      cy.get('[data-cy="editor-slug-input"]').should('be.visible')

      cy.log('New page form loaded')
    })
  })

  // ============================================================
  // Block Picker Tests
  // ============================================================
  describe('Block Picker', () => {
    it('PB-EDITOR-003: Should show block picker with available blocks', { tags: ['@smoke'] }, () => {
      allure.story('Block Picker')
      allure.severity('critical')

      cy.then(() => {
        PageBuilderPOM.visitEdit(testPageId)
        PageBuilderPOM.waitForEditorLoad()

        PageBuilderPOM.switchToLayoutMode()
        PageBuilderPOM.assertBlockPickerVisible()

        PageBuilderPOM.assertBlockInPicker('hero')
        PageBuilderPOM.assertBlockInPicker('cta-section')
        PageBuilderPOM.assertBlockInPicker('features-grid')

        cy.log('Block picker shows available blocks')
      })
    })

    it('PB-EDITOR-004: Should filter blocks by category', () => {
      allure.story('Block Picker')
      allure.severity('normal')

      cy.then(() => {
        PageBuilderPOM.visitEdit(testPageId)
        PageBuilderPOM.waitForEditorLoad()

        PageBuilderPOM.switchToLayoutMode()

        // Use 'cta' category (actual categories: features, cta, faq, content, hero, pricing, stats, testimonials)
        cy.get(PageBuilderPOM.editorSelectors.categoryTab('cta')).then(($tab) => {
          if ($tab.length > 0) {
            PageBuilderPOM.selectBlockCategory('cta')

            cy.get(PageBuilderPOM.editorSelectors.blockPicker).should('contain.text', 'CTA')

            cy.log('Block filtering by category works')
          } else {
            cy.log('Category tabs not available - skipping')
          }
        })
      })
    })

    it('PB-EDITOR-005: Should search blocks by name', () => {
      allure.story('Block Picker')
      allure.severity('normal')

      cy.then(() => {
        PageBuilderPOM.visitEdit(testPageId)
        PageBuilderPOM.waitForEditorLoad()

        PageBuilderPOM.switchToLayoutMode()
        PageBuilderPOM.searchBlocks('hero')
        PageBuilderPOM.assertBlockInPicker('hero')

        cy.log('Block search works')
      })
    })
  })

  // ============================================================
  // Mode Switching Tests
  // ============================================================
  describe('Mode Switching', () => {
    it('PB-EDITOR-006: Should switch between Layout and Preview mode', () => {
      allure.story('Mode Switching')
      allure.severity('normal')

      cy.then(() => {
        PageBuilderPOM.visitEdit(testPageId)
        PageBuilderPOM.waitForEditorLoad()

        PageBuilderPOM.switchToLayoutMode()
        PageBuilderPOM.addBlock('hero')

        PageBuilderPOM.switchToPreviewMode()
        cy.get(PageBuilderPOM.editorSelectors.previewCanvas).should('be.visible')

        PageBuilderPOM.switchToLayoutMode()
        cy.get(PageBuilderPOM.editorSelectors.blockCanvas).should('be.visible')

        cy.log('Mode switching works')
      })
    })
  })

  // ============================================================
  // Settings Panel Tests
  // ============================================================
  describe('Settings Panel', () => {
    it('PB-EDITOR-007: Should show settings panel when block is selected', () => {
      allure.story('Settings Panel')
      allure.severity('normal')

      cy.then(() => {
        PageBuilderPOM.visitEdit(testPageId)
        PageBuilderPOM.waitForEditorLoad()

        PageBuilderPOM.switchToLayoutMode()
        PageBuilderPOM.addBlock('hero')
        PageBuilderPOM.assertSettingsPanelHasContent()

        cy.log('Settings panel shows for selected block')
      })
    })

    it('PB-EDITOR-008: Should switch between settings tabs', () => {
      allure.story('Settings Panel')
      allure.severity('normal')

      cy.then(() => {
        PageBuilderPOM.visitEdit(testPageId)
        PageBuilderPOM.waitForEditorLoad()

        PageBuilderPOM.switchToLayoutMode()
        PageBuilderPOM.addBlock('hero')

        cy.get(PageBuilderPOM.editorSelectors.tabContent).then(($tab) => {
          if ($tab.length > 0) {
            PageBuilderPOM.selectSettingsTab('content')
            cy.get(PageBuilderPOM.editorSelectors.tabContent).should('have.attr', 'data-state', 'active')

            cy.get(PageBuilderPOM.editorSelectors.tabDesign).then(($design) => {
              if ($design.length > 0) {
                PageBuilderPOM.selectSettingsTab('design')
                cy.get(PageBuilderPOM.editorSelectors.tabDesign).should('have.attr', 'data-state', 'active')
              }
            })

            cy.log('Settings tabs switch correctly')
          } else {
            cy.log('Tabs not available - skipping')
          }
        })
      })
    })
  })

  // ============================================================
  // Save Tests
  // ============================================================
  describe('Save Functionality', () => {
    it('PB-EDITOR-009: Should save page changes', { tags: ['@smoke'] }, () => {
      allure.story('Save')
      allure.severity('critical')

      cy.then(() => {
        PageBuilderPOM.visitEdit(testPageId)
        PageBuilderPOM.waitForEditorLoad()

        PageBuilderPOM.switchToLayoutMode()
        PageBuilderPOM.addBlock('hero')
        PageBuilderPOM.savePage()
        PageBuilderPOM.api.waitForUpdate()

        // Verify via API (session auth with team header)
        cy.request({
          method: 'GET',
          url: `/api/v1/pages/${testPageId}`,
          headers: { 'x-team-id': OWNER_TEAM_ID }
        }).then((response) => {
          expect(response.body.data.blocks).to.have.length.at.least(1)
          expect(response.body.data.blocks[0].blockSlug).to.eq('hero')

          cy.log('Page saved with blocks')
        })
      })
    })

    it('PB-EDITOR-010: Should publish page', () => {
      allure.story('Publish')
      allure.severity('normal')

      cy.then(() => {
        PageBuilderPOM.visitEdit(testPageId)
        PageBuilderPOM.waitForEditorLoad()

        PageBuilderPOM.selectStatus('published')
        PageBuilderPOM.savePage()
        PageBuilderPOM.api.waitForUpdate()

        // Verify via API (session auth with team header)
        cy.request({
          method: 'GET',
          url: `/api/v1/pages/${testPageId}`,
          headers: { 'x-team-id': OWNER_TEAM_ID }
        }).then((response) => {
          expect(response.body.data.status).to.eq('published')
          cy.log('Page published successfully')
        })
      })
    })
  })
})
