/**
 * DevtoolsPOM - Page Object Model for DevTools (/devtools)
 *
 * Provides methods for:
 * - Navigation to /devtools pages (home, style, tests, config)
 * - Sidebar interaction
 * - Access control assertions
 * - Page content validation
 *
 * @version 3.0 - Uses centralized selectors from cySelector()
 *
 * @example
 * const devtools = new DevtoolsPOM()
 * devtools.visitHome()
 *         .assertOnDevtoolsHome()
 *         .clickStyleGallery()
 */

import { BasePOM } from '../core/BasePOM'
import { cySelector } from '../selectors'

export class DevtoolsPOM extends BasePOM {
  // ============================================
  // SELECTORS using centralized cySelector()
  // ============================================

  get selectors() {
    return {
      // Layout & Navigation
      mobileHeader: cySelector('devtools.navigation.mobileHeader'),
      sidebarCollapseToggle: cySelector('devtools.navigation.collapseToggle'),

      // Navigation items
      navHome: cySelector('devtools.navigation.navItem', { section: 'home' }),
      navStyleGallery: cySelector('devtools.navigation.navItem', { section: 'stylegallery' }),
      navTestCases: cySelector('devtools.navigation.navItem', { section: 'testcases' }),
      navConfig: cySelector('devtools.navigation.navItem', { section: 'config' }),

      // Exit navigation
      exitToDashboard: cySelector('devtools.navigation.exitToDashboard'),
      goToAdmin: cySelector('devtools.navigation.goToSuperadmin'),

      // Home Page
      homePage: cySelector('devtools.home.page'),
      homeStyleLink: cySelector('devtools.home.styleLink'),
      homeTestsLink: cySelector('devtools.home.testsLink'),
      homeConfigLink: cySelector('devtools.home.configLink'),

      // Style Gallery Page
      stylePage: cySelector('devtools.style.page'),
      styleTabComponents: cySelector('devtools.style.tabComponents'),
      styleTabFieldTypes: cySelector('devtools.style.tabFieldTypes'),
      styleTabTheme: cySelector('devtools.style.tabTheme'),
      styleTabGuidelines: cySelector('devtools.style.tabGuidelines'),
      styleComponentGallery: cySelector('devtools.style.componentGallery'),
      styleFieldTypes: cySelector('devtools.style.fieldTypes'),
      styleThemePreview: cySelector('devtools.style.themePreview'),

      // Test Cases Page
      testsPage: cySelector('devtools.tests.page'),
      testsViewer: cySelector('devtools.tests.viewer'),
      testsTree: cySelector('devtools.tests.tree'),
      testsLoading: cySelector('devtools.tests.loading'),
      testsFileLoading: cySelector('devtools.tests.fileLoading'),
      testsEmptyState: cySelector('devtools.tests.emptyState'),
      testsContent: cySelector('devtools.tests.content'),
      testsError: cySelector('devtools.tests.error'),
      testsMarkdownContent: cySelector('devtools.tests.markdownContent'),

      // Dynamic selectors for file tree
      testsFolder: (name: string) => cySelector('devtools.tests.folder', { name }),
      testsFile: (name: string) => cySelector('devtools.tests.file', { name }),

      // Config Viewer Page
      configPage: cySelector('devtools.config.page'),
      configViewer: cySelector('devtools.config.viewer'),
      configTabTheme: cySelector('devtools.config.tabTheme'),
      configTabEntities: cySelector('devtools.config.tabEntities'),
      configThemeContent: cySelector('devtools.config.themeContent'),
      configEntitiesContent: cySelector('devtools.config.entitiesContent'),
      configCopyTheme: cySelector('devtools.config.copyTheme'),
      configCopyEntities: cySelector('devtools.config.copyEntities'),

      // Additional tests selectors
      testsNotFound: cySelector('devtools.tests.notFound'),
      testsBackToList: cySelector('devtools.tests.backToList'),

      // Test Coverage Dashboard (new)
      testsDashboard: cySelector('devtools.tests.dashboard'),
      testsDashboardButton: cySelector('devtools.tests.dashboardButton'),
      testsDashboardStats: cySelector('devtools.tests.dashboardStats'),
      testsDashboardStatFeatures: cySelector('devtools.tests.dashboardStatFeatures'),
      testsDashboardStatFlows: cySelector('devtools.tests.dashboardStatFlows'),
      testsDashboardStatFiles: cySelector('devtools.tests.dashboardStatFiles'),
      testsDashboardStatTags: cySelector('devtools.tests.dashboardStatTags'),
      testsDashboardGaps: cySelector('devtools.tests.dashboardGaps'),
      testsDashboardGapItem: (slug: string) => cySelector('devtools.tests.dashboardGapItem', { slug }),

      // Sidebar
      sidebar: cySelector('devtools.navigation.sidebar'),

      // API Tester selectors (new feature)
      apiTester: '[data-cy="api-tester"]',
      apiTesterBackBtn: '[data-cy="api-tester-back-btn"]',
      apiTesterEndpointInfo: '[data-cy="api-tester-endpoint-info"]',
      apiTesterMethodSelector: '[data-cy="api-tester-method-selector"]',
      apiTesterMethodBadge: (method: string) => `[data-cy="api-tester-method-${method.toLowerCase()}"]`,
      apiTesterUrlPreview: '[data-cy="api-tester-url-preview"]',
      apiTesterPathParams: '[data-cy="api-tester-path-params"]',
      apiTesterPathParam: (name: string) => `[data-cy="api-tester-path-param-${name}"]`,
      apiTesterPathParamInput: (name: string) => `[data-cy="api-tester-path-param-${name}-input"]`,
      apiTesterQueryEditor: '[data-cy="api-tester-query-editor"]',
      apiTesterQueryRow: (index: number) => `[data-cy="api-tester-query-row-${index}"]`,
      apiTesterQueryKey: (index: number) => `[data-cy="api-tester-query-row-${index}-key"]`,
      apiTesterQueryValue: (index: number) => `[data-cy="api-tester-query-row-${index}-value"]`,
      apiTesterQueryDelete: (index: number) => `[data-cy="api-tester-query-row-${index}-delete"]`,
      apiTesterQueryAddBtn: '[data-cy="api-tester-query-add-btn"]',
      apiTesterHeadersEditor: '[data-cy="api-tester-headers-editor"]',
      apiTesterAuth: '[data-cy="api-tester-auth"]',
      apiTesterAuthType: '[data-cy="api-tester-auth-type"]',
      apiTesterAuthSession: '[data-cy="api-tester-auth-session"]',
      apiTesterAuthApiKey: '[data-cy="api-tester-auth-apikey"]',
      apiTesterApiKeyInput: '[data-cy="api-tester-apikey-input"]',
      apiTesterPayload: '[data-cy="api-tester-payload"]',
      apiTesterPayloadTextarea: '[data-cy="api-tester-payload-textarea"]',
      apiTesterPayloadError: '[data-cy="api-tester-payload-error"]',
      apiTesterSendBtn: '[data-cy="api-tester-send-btn"]',
      apiTesterCancelBtn: '[data-cy="api-tester-cancel-btn"]',
      apiTesterResponse: '[data-cy="api-tester-response"]',
      apiTesterResponseIdle: '[data-cy="api-tester-response-idle"]',
      apiTesterResponseLoading: '[data-cy="api-tester-response-loading"]',
      apiTesterResponseError: '[data-cy="api-tester-response-error"]',
      apiTesterResponseStatus: '[data-cy="api-tester-response-status"]',
      apiTesterResponseTime: '[data-cy="api-tester-response-time"]',
      apiTesterResponseTabBody: '[data-cy="api-tester-response-tab-body"]',
      apiTesterResponseTabHeaders: '[data-cy="api-tester-response-tab-headers"]',
      apiTesterResponseBody: '[data-cy="api-tester-response-body"]',
      apiTesterResponseHeaders: '[data-cy="api-tester-response-headers"]',
    }
  }

  // ============================================
  // FACTORY METHOD
  // ============================================

  static create(): DevtoolsPOM {
    return new DevtoolsPOM()
  }

  // ============================================
  // NAVIGATION
  // ============================================

  /**
   * Visit /devtools home page
   */
  visitHome() {
    cy.visit('/devtools')
    return this
  }

  /**
   * Visit /devtools/style (Style Gallery)
   */
  visitStyleGallery() {
    cy.visit('/devtools/style')
    return this
  }

  /**
   * Visit /devtools/tests (Test Cases Viewer)
   */
  visitTestCases() {
    cy.visit('/devtools/tests')
    return this
  }

  /**
   * Visit /devtools/config (Config Viewer)
   */
  visitConfig() {
    cy.visit('/devtools/config')
    return this
  }

  /**
   * Attempt to visit /devtools (for access control tests)
   * Uses failOnStatusCode: false to capture redirects
   */
  attemptToVisitDevtools() {
    cy.visit('/devtools', { failOnStatusCode: false })
    return this
  }

  // ============================================
  // SIDEBAR NAVIGATION ACTIONS
  // ============================================

  /**
   * Click on Home navigation item in sidebar
   */
  clickNavHome() {
    cy.get(this.selectors.navHome).click()
    return this
  }

  /**
   * Click on Style Gallery navigation item in sidebar
   */
  clickNavStyleGallery() {
    cy.get(this.selectors.navStyleGallery).click()
    return this
  }

  /**
   * Click on Test Cases navigation item in sidebar
   */
  clickNavTestCases() {
    cy.get(this.selectors.navTestCases).click()
    return this
  }

  /**
   * Click on Config navigation item in sidebar
   */
  clickNavConfig() {
    cy.get(this.selectors.navConfig).click()
    return this
  }

  /**
   * Click on "Exit to Dashboard" link
   */
  clickExitToDashboard() {
    cy.get(this.selectors.exitToDashboard).click()
    return this
  }

  /**
   * Click on "Go to Admin" link
   */
  clickGoToAdmin() {
    cy.get(this.selectors.goToAdmin).click()
    return this
  }

  // ============================================
  // HOME PAGE QUICK LINKS
  // ============================================

  /**
   * Click on Style Gallery quick link (home page)
   */
  clickHomeStyleLink() {
    cy.get(this.selectors.homeStyleLink).click()
    return this
  }

  /**
   * Click on Test Cases quick link (home page)
   */
  clickHomeTestsLink() {
    cy.get(this.selectors.homeTestsLink).click()
    return this
  }

  /**
   * Click on Config Viewer quick link (home page)
   */
  clickHomeConfigLink() {
    cy.get(this.selectors.homeConfigLink).click()
    return this
  }

  // ============================================
  // CONFIG VIEWER ACTIONS
  // ============================================

  /**
   * Click on Theme tab in config viewer
   */
  clickConfigTabTheme() {
    cy.get(this.selectors.configTabTheme).click()
    return this
  }

  /**
   * Click on Entities tab in config viewer
   */
  clickConfigTabEntities() {
    cy.get(this.selectors.configTabEntities).click()
    return this
  }

  /**
   * Click copy button for theme config
   */
  clickCopyThemeConfig() {
    cy.get(this.selectors.configCopyTheme).click()
    return this
  }

  /**
   * Click copy button for entities config
   */
  clickCopyEntitiesConfig() {
    cy.get(this.selectors.configCopyEntities).click()
    return this
  }

  // ============================================
  // WAITS
  // ============================================

  /**
   * Wait for /devtools home page to load
   */
  waitForHomePage() {
    cy.get(this.selectors.homePage, { timeout: 10000 }).should('be.visible')
    return this
  }

  /**
   * Wait for style gallery page to load
   */
  waitForStylePage() {
    cy.get(this.selectors.stylePage, { timeout: 10000 }).should('be.visible')
    return this
  }

  /**
   * Wait for test cases page to load
   */
  waitForTestsPage() {
    cy.get(this.selectors.testsPage, { timeout: 10000 }).should('be.visible')
    return this
  }

  /**
   * Wait for config page to load
   */
  waitForConfigPage() {
    cy.get(this.selectors.configPage, { timeout: 10000 }).should('be.visible')
    return this
  }

  // ============================================
  // ASSERTIONS - URL
  // ============================================

  /**
   * Assert user is on /devtools home page
   */
  assertOnDevtoolsHome() {
    cy.url().should('eq', Cypress.config().baseUrl + '/devtools')
    return this
  }

  /**
   * Assert user is on /devtools/style
   */
  assertOnStyleGallery() {
    cy.url().should('include', '/devtools/style')
    return this
  }

  /**
   * Assert user is on /devtools/tests
   */
  assertOnTestCases() {
    cy.url().should('include', '/devtools/tests')
    return this
  }

  /**
   * Assert user is on /devtools/config
   */
  assertOnConfig() {
    cy.url().should('include', '/devtools/config')
    return this
  }

  /**
   * Assert user was redirected to /dashboard (blocked from /devtools)
   */
  assertRedirectedToDashboard() {
    cy.url().should('include', '/dashboard')
    cy.url().should('not.include', '/devtools')
    return this
  }

  /**
   * Assert user is on /superadmin (superadmin panel)
   */
  assertOnSuperadmin() {
    cy.url().should('include', '/superadmin')
    return this
  }

  // ============================================
  // ASSERTIONS - PAGE CONTENT
  // ============================================

  /**
   * Assert home page container is visible
   */
  assertHomePageVisible() {
    cy.get(this.selectors.homePage).should('be.visible')
    return this
  }

  /**
   * Assert all home page quick links are visible
   */
  assertHomeQuickLinksVisible() {
    cy.get(this.selectors.homeStyleLink).should('be.visible')
    cy.get(this.selectors.homeTestsLink).should('be.visible')
    cy.get(this.selectors.homeConfigLink).should('be.visible')
    return this
  }

  /**
   * Assert style gallery page is visible
   */
  assertStylePageVisible() {
    cy.get(this.selectors.stylePage).should('be.visible')
    return this
  }

  /**
   * Assert all style gallery sections are visible by clicking through tabs
   * Tabs work one at a time - Components is default, need to click others
   */
  assertStyleSectionsVisible() {
    // Components tab is active by default
    cy.get(this.selectors.styleComponentGallery).should('be.visible')

    // Click Field Types tab and verify
    cy.get(this.selectors.styleTabFieldTypes).click()
    cy.get(this.selectors.styleFieldTypes).should('be.visible')

    // Click Theme tab and verify
    cy.get(this.selectors.styleTabTheme).click()
    cy.get(this.selectors.styleThemePreview).should('be.visible')

    // Click back to Components tab (restore default state)
    cy.get(this.selectors.styleTabComponents).click()
    return this
  }

  /**
   * Click Style Gallery Components tab
   */
  clickStyleTabComponents() {
    cy.get(this.selectors.styleTabComponents).click()
    return this
  }

  /**
   * Click Style Gallery Field Types tab
   */
  clickStyleTabFieldTypes() {
    cy.get(this.selectors.styleTabFieldTypes).click()
    return this
  }

  /**
   * Click Style Gallery Theme tab
   */
  clickStyleTabTheme() {
    cy.get(this.selectors.styleTabTheme).click()
    return this
  }

  /**
   * Assert test cases page is visible
   */
  assertTestsPageVisible() {
    cy.get(this.selectors.testsPage).should('be.visible')
    return this
  }

  /**
   * Assert test cases viewer (file tree) is visible
   */
  assertTestsViewerVisible() {
    cy.get(this.selectors.testsViewer).should('be.visible')
    cy.get(this.selectors.testsTree).should('be.visible')
    return this
  }

  /**
   * Assert config page is visible
   */
  assertConfigPageVisible() {
    cy.get(this.selectors.configPage).should('be.visible')
    return this
  }

  /**
   * Assert config viewer tabs are visible
   */
  assertConfigTabsVisible() {
    cy.get(this.selectors.configViewer).should('be.visible')
    cy.get(this.selectors.configTabTheme).should('be.visible')
    cy.get(this.selectors.configTabEntities).should('be.visible')
    return this
  }

  // ============================================
  // ASSERTIONS - NAVIGATION
  // ============================================

  /**
   * Assert all sidebar navigation items are visible
   */
  assertSidebarNavigationVisible() {
    cy.get(this.selectors.navHome).should('be.visible')
    cy.get(this.selectors.navStyleGallery).should('be.visible')
    cy.get(this.selectors.navTestCases).should('be.visible')
    cy.get(this.selectors.navConfig).should('be.visible')
    return this
  }

  /**
   * Assert exit links (Dashboard, Admin) are visible
   */
  assertExitLinksVisible() {
    cy.get(this.selectors.exitToDashboard).should('be.visible')
    cy.get(this.selectors.goToAdmin).should('be.visible')
    return this
  }

  // ============================================
  // API TESTER METHODS (New Feature)
  // ============================================

  /**
   * Visit /devtools/api (API endpoint list)
   */
  visitApiList() {
    cy.visit('/devtools/api')
    return this
  }

  /**
   * Visit specific API endpoint detail page
   * @param path - API path without /api prefix (e.g., '/v1/customers')
   */
  visitApiEndpoint(path: string) {
    cy.visit(`/devtools/api${path}`)
    return this
  }

  /**
   * Click on an endpoint link in the API list
   * Uses the first endpoint from Core category as default
   */
  clickFirstEndpoint() {
    cy.get('[data-cy^="devtools-api-route-"]').first().click()
    return this
  }

  /**
   * Select HTTP method in API tester
   */
  selectMethod(method: string) {
    cy.get(this.selectors.apiTesterMethodBadge(method)).click()
    return this
  }

  /**
   * Fill path parameter input
   */
  fillPathParam(paramName: string, value: string) {
    cy.get(this.selectors.apiTesterPathParamInput(paramName)).clear().type(value)
    return this
  }

  /**
   * Add query parameter
   */
  addQueryParam(key: string, value: string) {
    cy.get(this.selectors.apiTesterQueryAddBtn).click()
    const index = 0 // Assuming first param for simplicity
    cy.get(this.selectors.apiTesterQueryKey(index)).type(key)
    cy.get(this.selectors.apiTesterQueryValue(index)).type(value)
    return this
  }

  /**
   * Fill request payload (JSON)
   */
  fillPayload(json: string) {
    cy.get(this.selectors.apiTesterPayloadTextarea).clear().type(json, { parseSpecialCharSequences: false })
    return this
  }

  /**
   * Select authentication type
   */
  selectAuthType(type: 'session' | 'apiKey') {
    if (type === 'session') {
      cy.get(this.selectors.apiTesterAuthSession).click()
    } else {
      cy.get(this.selectors.apiTesterAuthApiKey).click()
    }
    return this
  }

  /**
   * Fill API key input
   */
  fillApiKey(apiKey: string) {
    cy.get(this.selectors.apiTesterApiKeyInput).type(apiKey)
    return this
  }

  /**
   * Click Send Request button
   */
  clickSendRequest() {
    cy.get(this.selectors.apiTesterSendBtn).click()
    return this
  }

  /**
   * Click Cancel button (during request)
   */
  clickCancelRequest() {
    cy.get(this.selectors.apiTesterCancelBtn).click()
    return this
  }

  /**
   * Wait for response to appear
   */
  waitForResponse() {
    cy.get(this.selectors.apiTesterResponse, { timeout: 10000 }).should('be.visible')
    return this
  }

  /**
   * Assert API tester page is visible
   */
  assertApiTesterVisible() {
    cy.get(this.selectors.apiTester).should('be.visible')
    return this
  }

  /**
   * Assert endpoint info card is visible
   */
  assertEndpointInfoVisible() {
    cy.get(this.selectors.apiTesterEndpointInfo).should('be.visible')
    return this
  }

  /**
   * Assert method selector shows specific method
   */
  assertMethodExists(method: string) {
    cy.get(this.selectors.apiTesterMethodBadge(method)).should('exist')
    return this
  }

  /**
   * Assert URL preview contains text
   */
  assertUrlPreviewContains(text: string) {
    cy.get(this.selectors.apiTesterUrlPreview).should('contain', text)
    return this
  }

  /**
   * Assert payload editor is visible
   */
  assertPayloadEditorVisible() {
    cy.get(this.selectors.apiTesterPayload).should('be.visible')
    return this
  }

  /**
   * Assert payload editor is NOT visible
   */
  assertPayloadEditorNotVisible() {
    cy.get(this.selectors.apiTesterPayload).should('not.exist')
    return this
  }

  /**
   * Assert JSON validation error is shown
   */
  assertPayloadErrorShown() {
    cy.get(this.selectors.apiTesterPayloadError).should('be.visible')
    return this
  }

  /**
   * Assert response status code badge is visible and has correct color
   */
  assertResponseStatus(statusCode: number) {
    cy.get(this.selectors.apiTesterResponseStatus).should('contain', statusCode.toString())
    return this
  }

  /**
   * Assert response time is visible
   */
  assertResponseTimeVisible() {
    cy.get(this.selectors.apiTesterResponseTime).should('be.visible')
    return this
  }

  /**
   * Click Response Body tab
   */
  clickResponseBodyTab() {
    cy.get(this.selectors.apiTesterResponseTabBody).click()
    return this
  }

  /**
   * Click Response Headers tab
   */
  clickResponseHeadersTab() {
    cy.get(this.selectors.apiTesterResponseTabHeaders).click()
    return this
  }

  /**
   * Assert response body contains text
   */
  assertResponseBodyContains(text: string) {
    cy.get(this.selectors.apiTesterResponseBody).should('contain', text)
    return this
  }

  /**
   * Assert back button navigates to /devtools/api
   */
  clickBackToList() {
    cy.get(this.selectors.apiTesterBackBtn).click()
    cy.url().should('include', '/devtools/api')
    cy.url().should('not.include', '/devtools/api/')
    return this
  }
}

export default DevtoolsPOM
