/// <reference types="cypress" />

import * as allure from 'allure-cypress'
import { DevtoolsPOM } from '../../../src/features/DevtoolsPOM'
import { loginAsDefaultDeveloper } from '../../../src/session-helpers'

/**
 * DevTools Page Content Tests
 *
 * Tests the content and functionality of each /devtools page:
 * - Home page renders quick links
 * - Style Gallery loads all components
 * - Test Cases viewer shows file tree
 * - Config viewer shows tabs and content
 *
 * Test User:
 * - Developer: developer@nextspark.dev (via loginAsDefaultDeveloper)
 */

describe('DevTools - Page Content', {
  tags: ['@uat', '@area-devtools', '@regression']
}, () => {
  const devtools = DevtoolsPOM.create()

  beforeEach(() => {
    allure.epic('UAT')
    allure.feature('DevTools')
    allure.story('Page Content')

    // Login as developer before each test
    loginAsDefaultDeveloper()
  })

  describe('PAGE-001: Home page renders quick links', () => {
    it('should display all quick link cards on home page', () => {
      allure.severity('high')

      // 1. Visit /devtools home
      devtools.visitHome()

      // 2. Verify page container is visible
      devtools.assertHomePageVisible()

      // 3. Verify all quick links are visible
      devtools.assertHomeQuickLinksVisible()

      // 4. Verify quick links are clickable and navigate correctly
      cy.log('Testing Style Gallery quick link...')
      devtools.clickHomeStyleLink()
      devtools.assertOnStyleGallery()

      cy.log('Testing Test Cases quick link...')
      devtools.visitHome()
      devtools.clickHomeTestsLink()
      devtools.assertOnTestCases()

      cy.log('Testing Config Viewer quick link...')
      devtools.visitHome()
      devtools.clickHomeConfigLink()
      devtools.assertOnConfig()

      cy.log(`✅ Home page quick links work correctly`)
    })
  })

  describe('PAGE-002: Style Gallery loads components', () => {
    it('should display all Style Gallery sections', () => {
      allure.severity('high')

      // 1. Visit /devtools/style
      devtools.visitStyleGallery()

      // 2. Verify page is visible
      devtools.assertStylePageVisible()

      // 3. Verify all tab sections by clicking through them
      // (assertStyleSectionsVisible clicks each tab and verifies content)
      devtools.assertStyleSectionsVisible()

      cy.log(`✅ Style Gallery sections loaded correctly`)
    })
  })

  describe('PAGE-003: Test Cases viewer shows file tree', () => {
    it('should display test cases viewer with file tree', () => {
      allure.severity('high')

      // 1. Visit /devtools/tests
      devtools.visitTestCases()

      // 2. Verify page is visible
      devtools.assertTestsPageVisible()

      // 3. Verify viewer container is visible
      devtools.assertTestsViewerVisible()

      // 4. Verify file tree is present (or empty state if no files)
      cy.get('body').then(($body) => {
        if ($body.find(devtools.selectors.testsTree).length > 0) {
          // File tree exists
          cy.get(devtools.selectors.testsTree).should('be.visible')
          cy.log('✅ File tree displayed')
        } else if ($body.find(devtools.selectors.testsEmptyState).length > 0) {
          // Empty state (no test files)
          cy.get(devtools.selectors.testsEmptyState).should('be.visible')
          cy.log('✅ Empty state displayed (no test files found)')
        }
      })

      cy.log(`✅ Test Cases viewer loaded correctly`)
    })

    it('should show markdown content when selecting a file', () => {
      allure.severity('medium')

      // 1. Visit /devtools/tests
      devtools.visitTestCases()

      // 2. Check if file tree has files
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="dev-tests-file-"]').length > 0) {
          // Files exist - click first file
          cy.get('[data-cy^="dev-tests-file-"]').first().click()

          // 3. Verify markdown content is displayed
          cy.get(devtools.selectors.testsContent).should('be.visible')
          cy.get(devtools.selectors.testsMarkdownContent).should('be.visible')

          cy.log('✅ File content displayed when selected')
        } else {
          cy.log('⚠️ No test files found - skipping file selection test')
        }
      })
    })
  })

  describe('PAGE-004: Config viewer shows tabs', () => {
    it('should display config viewer with tabs', () => {
      allure.severity('high')

      // 1. Visit /devtools/config
      devtools.visitConfig()

      // 2. Verify page is visible
      devtools.assertConfigPageVisible()

      // 3. Verify tabs are visible
      devtools.assertConfigTabsVisible()

      // 4. Test Theme tab
      cy.log('Testing Theme tab...')
      devtools.clickConfigTabTheme()
      cy.get(devtools.selectors.configThemeContent).should('be.visible')

      // 5. Test Entities tab
      cy.log('Testing Entities tab...')
      devtools.clickConfigTabEntities()
      cy.get(devtools.selectors.configEntitiesContent).should('be.visible')

      cy.log(`✅ Config viewer tabs work correctly`)
    })

    it('should display copy buttons in config viewer', () => {
      allure.severity('medium')

      // 1. Visit /devtools/config
      devtools.visitConfig()

      // 2. Verify copy buttons exist for theme config
      devtools.clickConfigTabTheme()
      cy.get(devtools.selectors.configCopyTheme).should('be.visible')

      // 3. Verify copy buttons exist for entities config
      devtools.clickConfigTabEntities()
      cy.get(devtools.selectors.configCopyEntities).should('be.visible')

      cy.log(`✅ Copy buttons displayed correctly`)
    })
  })

  after(() => {
    cy.log('✅ DevTools page content tests completed')
  })
})
