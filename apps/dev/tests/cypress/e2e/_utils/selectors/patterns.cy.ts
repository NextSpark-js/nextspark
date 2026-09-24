/**
 * UI Selectors Validation: Patterns
 *
 * This test validates that patterns-specific selectors exist in the DOM.
 * This is a lightweight test that ONLY checks selector presence, not functionality.
 *
 * Purpose:
 * - Validate PatternsPOM and PageBuilderPOM selectors work correctly
 * - Ensure all patterns-specific selectors are implemented
 * - Validate KEY DIFFERENCES from standard entity editor:
 *   - NO slug input (patterns don't have slugs)
 *   - NO patterns tab in block picker (to prevent recursive patterns)
 * - Run as Phase 12 sub-gate before functional tests
 *
 * Scope:
 * - Navigate to patterns pages (requires login)
 * - Assert elements exist in DOM (no form submissions)
 * - Fast execution (< 30 seconds per describe block)
 *
 * Test IDs:
 * - SEL_PAT_001: Patterns List Page Selectors (5 selectors)
 * - SEL_PAT_002: Patterns List Table Actions (4 selectors)
 * - SEL_PAT_003: Patterns Editor Header - KEY DIFFERENCES (5 selectors)
 * - SEL_PAT_004: Patterns Editor Block Picker - KEY DIFFERENCES (5 selectors)
 * - SEL_PAT_005: Patterns Reports Page (4 selectors)
 * - SEL_PAT_006: Pattern Usage Stats (3 selectors)
 * - SEL_PAT_007: Pattern Usage Report Controls (5 selectors)
 * - SEL_PAT_008: Pattern Usage Table (3 selectors)
 *
 * DEPENDENCIES:
 * - Sample patterns must exist (from seed data)
 * - At least one pattern must have usages (for reports tests)
 */

import { PatternsPOM } from '../../../src/entities/PatternsPOM'
import { cySelector } from '../../../src/selectors'
import { loginAsDefaultDeveloper } from '../../../src/session-helpers'

describe('Patterns Selectors Validation', { tags: ['@ui-selectors', '@patterns', '@feat-patterns'] }, () => {
  const patterns = PatternsPOM.create()

  // ============================================
  // SEL_PAT_001: PATTERNS LIST PAGE SELECTORS (5 selectors)
  // ============================================
  describe('SEL_PAT_001: Patterns List Page Selectors', { tags: '@SEL_PAT_001' }, () => {
    beforeEach(() => {
      loginAsDefaultDeveloper()
      patterns.visitList()
      patterns.waitForList()
    })

    it('SEL_PAT_001_01: should find page container', { tags: '@SEL_PAT_001_01' }, () => {
      cy.get(patterns.selectors.page).should('exist')
    })

    it('SEL_PAT_001_02: should find page title', { tags: '@SEL_PAT_001_02' }, () => {
      cy.get(patterns.selectors.title).should('exist')
    })

    it('SEL_PAT_001_03: should find add button', { tags: '@SEL_PAT_001_03' }, () => {
      cy.get(patterns.selectors.addButton).should('exist')
    })

    it('SEL_PAT_001_04: should find search container', { tags: '@SEL_PAT_001_04' }, () => {
      cy.get(patterns.selectors.searchContainer).should('exist')
    })

    it('SEL_PAT_001_05: should find table container (or empty state)', { tags: '@SEL_PAT_001_05' }, () => {
      // Check for table OR empty state - both are valid depending on data
      cy.get('body').then(($body) => {
        if ($body.find(patterns.selectors.table).length > 0) {
          cy.get(patterns.selectors.table).should('exist')
        } else if ($body.find('[data-cy^="patterns-row-"]').length === 0) {
          // No patterns exist, empty state is acceptable
          cy.log('⚠️ Table not found - patterns may not exist (empty state is valid)')
        } else {
          // Patterns exist but table not found - this is a real error
          cy.get(patterns.selectors.table).should('exist')
        }
      })
    })
  })

  // ============================================
  // SEL_PAT_002: PATTERNS LIST TABLE ACTIONS (4 selectors)
  // REQUIRES: At least one pattern in the database
  // NOTE: These tests are skipped if no patterns exist (data-dependent)
  // ============================================
  describe('SEL_PAT_002: Patterns List Table Actions', { tags: '@SEL_PAT_002' }, () => {
    beforeEach(() => {
      loginAsDefaultDeveloper()
      patterns.visitList()
      patterns.waitForList()
    })

    it('SEL_PAT_002_01: should find row menu for first pattern', { tags: '@SEL_PAT_002_01' }, () => {
      // Check if patterns exist, skip if none
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="patterns-row-"]').length === 0) {
          cy.log('⚠️ No patterns found - skipping test (data-dependent)')
          return // Skip the rest of the test
        }
        cy.get('[data-cy^="patterns-row-"]').first().then(($row) => {
          const dataCy = $row.attr('data-cy')
          const patternId = dataCy?.replace('patterns-row-', '')
          if (patternId) {
            cy.get(patterns.selectors.rowMenu(patternId)).should('exist')
          }
        })
      })
    })

    it('SEL_PAT_002_02: should find edit action in row menu', { tags: '@SEL_PAT_002_02' }, () => {
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="patterns-row-"]').length === 0) {
          cy.log('⚠️ No patterns found - skipping test (data-dependent)')
          return
        }
        cy.get('[data-cy^="patterns-row-"]').first().then(($row) => {
          const dataCy = $row.attr('data-cy')
          const patternId = dataCy?.replace('patterns-row-', '')
          if (patternId) {
            cy.get(patterns.selectors.rowMenu(patternId)).click()
            cy.get(patterns.selectors.rowAction('edit', patternId)).should('exist')
          }
        })
      })
    })

    it('SEL_PAT_002_03: should find delete action in row menu', { tags: '@SEL_PAT_002_03' }, () => {
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="patterns-row-"]').length === 0) {
          cy.log('⚠️ No patterns found - skipping test (data-dependent)')
          return
        }
        cy.get('[data-cy^="patterns-row-"]').first().then(($row) => {
          const dataCy = $row.attr('data-cy')
          const patternId = dataCy?.replace('patterns-row-', '')
          if (patternId) {
            cy.get(patterns.selectors.rowMenu(patternId)).click()
            cy.get(patterns.selectors.rowAction('delete', patternId)).should('exist')
          }
        })
      })
    })

    it('SEL_PAT_002_04: should find usages quick action in row menu', { tags: '@SEL_PAT_002_04' }, () => {
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="patterns-row-"]').length === 0) {
          cy.log('⚠️ No patterns found - skipping test (data-dependent)')
          return
        }
        cy.get('[data-cy^="patterns-row-"]').first().then(($row) => {
          const dataCy = $row.attr('data-cy')
          const patternId = dataCy?.replace('patterns-row-', '')
          if (patternId) {
            cy.get(patterns.selectors.rowMenu(patternId)).click()
            cy.get(patterns.selectors.rowAction('usages', patternId)).should('exist')
          }
        })
      })
    })
  })

  // ============================================
  // SEL_PAT_003: PATTERNS EDITOR HEADER - KEY DIFFERENCES (5 selectors)
  // NOTE: Patterns editor does NOT have slug input (unlike pages/posts)
  // ============================================
  describe('SEL_PAT_003: Patterns Editor Header', { tags: '@SEL_PAT_003' }, () => {
    beforeEach(() => {
      loginAsDefaultDeveloper()
      // Navigate to create a new pattern
      cy.visit('/dashboard/patterns/create', { timeout: 60000 })
      // Wait for editor to load using block editor selector
      cy.get(cySelector('blockEditor.header.container'), { timeout: 15000 }).should('be.visible')
    })

    it('SEL_PAT_003_01: should find header container', { tags: '@SEL_PAT_003_01' }, () => {
      cy.get(cySelector('blockEditor.header.container')).should('exist')
    })

    it('SEL_PAT_003_02: should find title input', { tags: '@SEL_PAT_003_02' }, () => {
      cy.get(cySelector('blockEditor.header.titleInput')).should('exist')
    })

    it('SEL_PAT_003_03: should NOT have slug input (patterns-specific)', { tags: '@SEL_PAT_003_03' }, () => {
      // KEY DIFFERENCE: Patterns do not have slugs
      cy.get(cySelector('blockEditor.header.slugInput')).should('not.exist')
    })

    it('SEL_PAT_003_04: should find save button', { tags: '@SEL_PAT_003_04' }, () => {
      cy.get(cySelector('blockEditor.header.saveButton')).should('exist')
    })

    it('SEL_PAT_003_05: should find view mode toggle', { tags: '@SEL_PAT_003_05' }, () => {
      cy.get(cySelector('blockEditor.header.viewToggle')).should('exist')
    })
  })

  // ============================================
  // SEL_PAT_004: PATTERNS EDITOR BLOCK PICKER - KEY DIFFERENCES (5 selectors)
  // NOTE: Patterns block picker does NOT have patterns tab (to prevent recursion)
  // ============================================
  describe('SEL_PAT_004: Patterns Editor Block Picker', { tags: '@SEL_PAT_004' }, () => {
    beforeEach(() => {
      loginAsDefaultDeveloper()
      cy.visit('/dashboard/patterns/create', { timeout: 60000 })
      cy.get(cySelector('blockEditor.header.container'), { timeout: 15000 }).should('be.visible')
    })

    it('SEL_PAT_004_01: should find block picker container', { tags: '@SEL_PAT_004_01' }, () => {
      cy.get(cySelector('blockEditor.blockPicker.container')).should('exist')
    })

    it('SEL_PAT_004_02: should find blocks tab', { tags: '@SEL_PAT_004_02' }, () => {
      cy.get(cySelector('blockEditor.blockPicker.tabBlocks')).should('exist')
    })

    it('SEL_PAT_004_03: should NOT have patterns tab (patterns-specific)', { tags: '@SEL_PAT_004_03' }, () => {
      // KEY DIFFERENCE: Patterns cannot contain other patterns (prevent recursion)
      cy.get(cySelector('blockEditor.blockPicker.tabPatterns')).should('not.exist')
    })

    it.skip('SEL_PAT_004_04: should find config tab (skipped - patterns have no sidebarFields/taxonomies)', { tags: '@SEL_PAT_004_04' }, () => {
      // Config tab only appears when entity has sidebarFields or taxonomies enabled
      // Patterns entity doesn't have either, so this tab is correctly hidden
      cy.get(cySelector('blockEditor.blockPicker.tabConfig')).should('exist')
    })

    it('SEL_PAT_004_05: should find search input', { tags: '@SEL_PAT_004_05' }, () => {
      cy.get(cySelector('blockEditor.blockPicker.searchInput')).should('exist')
    })
  })

  // ============================================
  // SEL_PAT_005: PATTERNS REPORTS PAGE (4 selectors)
  // REQUIRES: A pattern with usages for meaningful tests
  // NOTE: These tests are skipped if no patterns exist (data-dependent)
  // ============================================
  describe('SEL_PAT_005: Patterns Reports Page', { tags: '@SEL_PAT_005' }, () => {
    beforeEach(() => {
      loginAsDefaultDeveloper()
      patterns.visitList()
      patterns.waitForList()
    })

    it('SEL_PAT_005_01: should navigate to pattern usages and find report container', { tags: '@SEL_PAT_005_01' }, () => {
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="patterns-row-"]').length === 0) {
          cy.log('⚠️ No patterns found - skipping test (data-dependent)')
          return
        }
        cy.get('[data-cy^="patterns-row-"]').first().then(($row) => {
          const dataCy = $row.attr('data-cy')
          const patternId = dataCy?.replace('patterns-row-', '')
          if (patternId) {
            cy.get(patterns.selectors.rowMenu(patternId)).click()
            cy.get(patterns.selectors.rowAction('usages', patternId)).click()
            cy.get(patterns.patternSelectors.usageReport.container, { timeout: 15000 }).should('exist')
          }
        })
      })
    })

    it('SEL_PAT_005_02: should find back button on usages page', { tags: '@SEL_PAT_005_02' }, () => {
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="patterns-row-"]').length === 0) {
          cy.log('⚠️ No patterns found - skipping test (data-dependent)')
          return
        }
        cy.get('[data-cy^="patterns-row-"]').first().then(($row) => {
          const dataCy = $row.attr('data-cy')
          const patternId = dataCy?.replace('patterns-row-', '')
          if (patternId) {
            cy.get(patterns.selectors.rowMenu(patternId)).click()
            cy.get(patterns.selectors.rowAction('usages', patternId)).click()
            cy.get(patterns.patternSelectors.usageReport.container, { timeout: 15000 }).should('exist')
            cy.get(patterns.selectors.backButton).should('exist')
          }
        })
      })
    })

    it('SEL_PAT_005_03: should find page title on usages page', { tags: '@SEL_PAT_005_03' }, () => {
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="patterns-row-"]').length === 0) {
          cy.log('⚠️ No patterns found - skipping test (data-dependent)')
          return
        }
        cy.get('[data-cy^="patterns-row-"]').first().then(($row) => {
          const dataCy = $row.attr('data-cy')
          const patternId = dataCy?.replace('patterns-row-', '')
          if (patternId) {
            cy.get(patterns.selectors.rowMenu(patternId)).click()
            cy.get(patterns.selectors.rowAction('usages', patternId)).click()
            cy.get(patterns.patternSelectors.usageReport.container, { timeout: 15000 }).should('exist')
            cy.get(patterns.selectors.headerTitle).should('exist')
          }
        })
      })
    })

    it('SEL_PAT_005_04: should find edit button on usages page', { tags: '@SEL_PAT_005_04' }, () => {
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="patterns-row-"]').length === 0) {
          cy.log('⚠️ No patterns found - skipping test (data-dependent)')
          return
        }
        cy.get('[data-cy^="patterns-row-"]').first().then(($row) => {
          const dataCy = $row.attr('data-cy')
          const patternId = dataCy?.replace('patterns-row-', '')
          if (patternId) {
            cy.get(patterns.selectors.rowMenu(patternId)).click()
            cy.get(patterns.selectors.rowAction('usages', patternId)).click()
            cy.get(patterns.patternSelectors.usageReport.container, { timeout: 15000 }).should('exist')
            cy.get(patterns.selectors.editButton).should('exist')
          }
        })
      })
    })
  })

  // ============================================
  // SEL_PAT_006: PATTERN USAGE STATS (3 selectors)
  // NOTE: These tests are skipped if no patterns exist (data-dependent)
  // ============================================
  describe('SEL_PAT_006: Pattern Usage Stats', { tags: '@SEL_PAT_006' }, () => {
    // Helper to navigate to usages page if patterns exist
    const navigateToUsagesIfPatternsExist = () => {
      return cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="patterns-row-"]').length === 0) {
          return false
        }
        cy.get('[data-cy^="patterns-row-"]').first().then(($row) => {
          const dataCy = $row.attr('data-cy')
          const patternId = dataCy?.replace('patterns-row-', '')
          if (patternId) {
            cy.get(patterns.selectors.rowMenu(patternId)).click()
            cy.get(patterns.selectors.rowAction('usages', patternId)).click()
            cy.get(patterns.patternSelectors.usageReport.container, { timeout: 15000 }).should('exist')
          }
        })
        return true
      })
    }

    beforeEach(() => {
      loginAsDefaultDeveloper()
      patterns.visitList()
      patterns.waitForList()
    })

    it('SEL_PAT_006_01: should find stats container', { tags: '@SEL_PAT_006_01' }, () => {
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="patterns-row-"]').length === 0) {
          cy.log('⚠️ No patterns found - skipping test (data-dependent)')
          return
        }
        navigateToUsagesIfPatternsExist().then(() => {
          cy.get(patterns.patternSelectors.usageStats.container).should('exist')
        })
      })
    })

    it('SEL_PAT_006_02: should find total usage card', { tags: '@SEL_PAT_006_02' }, () => {
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="patterns-row-"]').length === 0) {
          cy.log('⚠️ No patterns found - skipping test (data-dependent)')
          return
        }
        navigateToUsagesIfPatternsExist().then(() => {
          cy.get(patterns.patternSelectors.usageStats.total).should('exist')
        })
      })
    })

    it('SEL_PAT_006_03: should find usage by type cards (if usages exist)', { tags: '@SEL_PAT_006_03' }, () => {
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="patterns-row-"]').length === 0) {
          cy.log('⚠️ No patterns found - skipping test (data-dependent)')
          return
        }
        navigateToUsagesIfPatternsExist().then(() => {
          cy.get('body').then(($innerBody) => {
            if ($innerBody.find(patterns.patternSelectors.usageStats.byType('pages')).length > 0) {
              cy.get(patterns.patternSelectors.usageStats.byType('pages')).should('exist')
            } else if ($innerBody.find(patterns.patternSelectors.usageStats.byType('posts')).length > 0) {
              cy.get(patterns.patternSelectors.usageStats.byType('posts')).should('exist')
            } else {
              cy.log('No usage by type cards found - pattern may have no usages')
            }
          })
        })
      })
    })
  })

  // ============================================
  // SEL_PAT_007: PATTERN USAGE REPORT CONTROLS (5 selectors)
  // NOTE: These tests are skipped if no patterns exist (data-dependent)
  // ============================================
  describe('SEL_PAT_007: Pattern Usage Report Controls', { tags: '@SEL_PAT_007' }, () => {
    // Helper to navigate to usages page if patterns exist
    const navigateToUsagesIfPatternsExist = () => {
      return cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="patterns-row-"]').length === 0) {
          return false
        }
        cy.get('[data-cy^="patterns-row-"]').first().then(($row) => {
          const dataCy = $row.attr('data-cy')
          const patternId = dataCy?.replace('patterns-row-', '')
          if (patternId) {
            cy.get(patterns.selectors.rowMenu(patternId)).click()
            cy.get(patterns.selectors.rowAction('usages', patternId)).click()
            cy.get(patterns.patternSelectors.usageReport.container, { timeout: 15000 }).should('exist')
          }
        })
        return true
      })
    }

    beforeEach(() => {
      loginAsDefaultDeveloper()
      patterns.visitList()
      patterns.waitForList()
    })

    it('SEL_PAT_007_01: should find report container', { tags: '@SEL_PAT_007_01' }, () => {
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="patterns-row-"]').length === 0) {
          cy.log('⚠️ No patterns found - skipping test (data-dependent)')
          return
        }
        navigateToUsagesIfPatternsExist().then(() => {
          cy.get(patterns.patternSelectors.usageReport.container).should('exist')
        })
      })
    })

    it('SEL_PAT_007_02: should find filter select', { tags: '@SEL_PAT_007_02' }, () => {
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="patterns-row-"]').length === 0) {
          cy.log('⚠️ No patterns found - skipping test (data-dependent)')
          return
        }
        navigateToUsagesIfPatternsExist().then(() => {
          cy.get(patterns.patternSelectors.usageReport.filterSelect).should('exist')
        })
      })
    })

    it('SEL_PAT_007_03: should find pagination container', { tags: '@SEL_PAT_007_03' }, () => {
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="patterns-row-"]').length === 0) {
          cy.log('⚠️ No patterns found - skipping test (data-dependent)')
          return
        }
        navigateToUsagesIfPatternsExist().then(() => {
          cy.get(patterns.patternSelectors.usageReport.pagination).should('exist')
        })
      })
    })

    it('SEL_PAT_007_04: should find prev page button', { tags: '@SEL_PAT_007_04' }, () => {
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="patterns-row-"]').length === 0) {
          cy.log('⚠️ No patterns found - skipping test (data-dependent)')
          return
        }
        navigateToUsagesIfPatternsExist().then(() => {
          cy.get(patterns.patternSelectors.usageReport.prevPage).should('exist')
        })
      })
    })

    it('SEL_PAT_007_05: should find next page button', { tags: '@SEL_PAT_007_05' }, () => {
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="patterns-row-"]').length === 0) {
          cy.log('⚠️ No patterns found - skipping test (data-dependent)')
          return
        }
        navigateToUsagesIfPatternsExist().then(() => {
          cy.get(patterns.patternSelectors.usageReport.nextPage).should('exist')
        })
      })
    })

    it('SEL_PAT_007_06: should find results info', { tags: '@SEL_PAT_007_06' }, () => {
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="patterns-row-"]').length === 0) {
          cy.log('⚠️ No patterns found - skipping test (data-dependent)')
          return
        }
        navigateToUsagesIfPatternsExist().then(() => {
          cy.get(patterns.patternSelectors.usageReport.resultsInfo).should('exist')
        })
      })
    })
  })

  // ============================================
  // SEL_PAT_008: PATTERN USAGE TABLE (3 selectors)
  // NOTE: These tests are skipped if no patterns exist (data-dependent)
  // ============================================
  describe('SEL_PAT_008: Pattern Usage Table', { tags: '@SEL_PAT_008' }, () => {
    // Helper to navigate to usages page if patterns exist
    const navigateToUsagesIfPatternsExist = () => {
      return cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="patterns-row-"]').length === 0) {
          return false
        }
        cy.get('[data-cy^="patterns-row-"]').first().then(($row) => {
          const dataCy = $row.attr('data-cy')
          const patternId = dataCy?.replace('patterns-row-', '')
          if (patternId) {
            cy.get(patterns.selectors.rowMenu(patternId)).click()
            cy.get(patterns.selectors.rowAction('usages', patternId)).click()
            cy.get(patterns.patternSelectors.usageReport.container, { timeout: 15000 }).should('exist')
          }
        })
        return true
      })
    }

    beforeEach(() => {
      loginAsDefaultDeveloper()
      patterns.visitList()
      patterns.waitForList()
    })

    it('SEL_PAT_008_01: should find usage table container (or empty state)', { tags: '@SEL_PAT_008_01' }, () => {
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy^="patterns-row-"]').length === 0) {
          cy.log('⚠️ No patterns found - skipping test (data-dependent)')
          return
        }
        navigateToUsagesIfPatternsExist().then(() => {
          cy.get('body').then(($innerBody) => {
            if ($innerBody.find(patterns.patternSelectors.usageTable.container).length > 0) {
              cy.get(patterns.patternSelectors.usageTable.container).should('exist')
            } else {
              cy.get(patterns.patternSelectors.usageTable.empty).should('exist')
            }
          })
        })
      })
    })

    it.skip('SEL_PAT_008_02: should find usage row (requires pattern with usages)', { tags: '@SEL_PAT_008_02' }, () => {
      // This test requires the pattern to have actual usages
      cy.get('[data-cy^="pattern-usage-row-"]').first().should('exist')
    })

    it.skip('SEL_PAT_008_03: should find view link in usage row (requires pattern with usages)', { tags: '@SEL_PAT_008_03' }, () => {
      // This test requires the pattern to have actual usages
      cy.get('[data-cy^="pattern-usage-view-"]').first().should('exist')
    })
  })
})
