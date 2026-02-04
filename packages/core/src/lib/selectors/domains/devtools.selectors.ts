/**
 * Devtools Selectors
 *
 * Selectors for the developer tools panel:
 * - Navigation
 * - Home page
 * - Style guide
 * - Config viewer
 * - Tests viewer
 * - Features/Flows/Blocks coverage
 * - Tags explorer
 * - Scheduled actions
 */

export const DEVTOOLS_SELECTORS = {
  navigation: {
    sidebar: 'devtools-sidebar',
    collapseToggle: 'devtools-sidebar-collapse-toggle',
    navItem: 'devtools-nav-{section}',
    exitToDashboard: 'devtools-sidebar-exit-to-dashboard',
    goToSuperadmin: 'devtools-sidebar-go-to-superadmin',
    mobileHeader: 'devtools-mobile-header',
  },
  home: {
    page: 'devtools-home-page',
    styleLink: 'devtools-home-style-link',
    testsLink: 'devtools-home-tests-link',
    configLink: 'devtools-home-config-link',
  },
  style: {
    page: 'devtools-style-page',
    tabComponents: 'devtools-style-tab-components',
    tabFieldTypes: 'devtools-style-tab-field-types',
    tabTheme: 'devtools-style-tab-theme',
    tabGuidelines: 'devtools-style-tab-guidelines',
    componentGallery: 'devtools-style-component-gallery',
    fieldTypes: 'devtools-style-field-types',
    themePreview: 'devtools-style-theme-preview',
  },
  config: {
    page: 'devtools-config-page',
    viewer: 'devtools-config-viewer',
    tabTheme: 'devtools-config-tab-theme',
    tabEntities: 'devtools-config-tab-entities',
    themeContent: 'devtools-config-theme-content',
    entitiesContent: 'devtools-config-entities-content',
    copyTheme: 'devtools-config-copy-theme',
    copyEntities: 'devtools-config-copy-entities',
  },
  tests: {
    page: 'devtools-tests-page',
    viewer: 'devtools-tests-viewer',
    loading: 'devtools-tests-loading',
    tree: 'devtools-tests-tree',
    folder: 'devtools-tests-folder-{name}',
    file: 'devtools-tests-file-{name}',
    content: 'devtools-tests-content',
    markdownContent: 'devtools-tests-markdown-content',
    notFound: 'devtools-tests-not-found',
    backToList: 'devtools-tests-back-to-list',
    emptyState: 'devtools-tests-empty-state',
    fileLoading: 'devtools-tests-file-loading',
    error: 'devtools-tests-error',
    // Dashboard
    dashboard: 'devtools-tests-dashboard',
    dashboardButton: 'devtools-tests-dashboard-button',
    dashboardStats: 'devtools-tests-dashboard-stats',
    dashboardStatFeatures: 'devtools-tests-dashboard-stat-features',
    dashboardStatFlows: 'devtools-tests-dashboard-stat-flows',
    dashboardStatFiles: 'devtools-tests-dashboard-stat-files',
    dashboardStatTags: 'devtools-tests-dashboard-stat-tags',
    dashboardGaps: 'devtools-tests-dashboard-gaps',
    dashboardGapItem: 'devtools-tests-dashboard-gap-{slug}',
  },
  features: {
    page: 'devtools-features-page',
    viewer: 'devtools-features-viewer',
    search: 'devtools-features-search',
    filterAll: 'devtools-features-filter-all',
    filterCategory: 'devtools-features-filter-{category}',
    coverageAll: 'devtools-features-coverage-all',
    coverageCovered: 'devtools-features-coverage-covered',
    coverageUncovered: 'devtools-features-coverage-uncovered',
    card: 'devtools-features-card-{slug}',
    copyTag: 'devtools-features-copy-{slug}',
  },
  flows: {
    page: 'devtools-flows-page',
    viewer: 'devtools-flows-viewer',
    search: 'devtools-flows-search',
    filterAll: 'devtools-flows-filter-all',
    filterCategory: 'devtools-flows-filter-{category}',
    coverageAll: 'devtools-flows-coverage-all',
    coverageCovered: 'devtools-flows-coverage-covered',
    coverageUncovered: 'devtools-flows-coverage-uncovered',
    card: 'devtools-flows-card-{slug}',
    copyTag: 'devtools-flows-copy-{slug}',
  },
  blocks: {
    page: 'devtools-blocks-page',
    viewer: 'devtools-blocks-viewer',
    search: 'devtools-blocks-search',
    filterAll: 'devtools-blocks-filter-all',
    filterCategory: 'devtools-blocks-filter-{category}',
    coverageAll: 'devtools-blocks-coverage-all',
    coverageCovered: 'devtools-blocks-coverage-covered',
    coverageUncovered: 'devtools-blocks-coverage-uncovered',
    card: 'devtools-blocks-card-{slug}',
    copyTag: 'devtools-blocks-copy-{slug}',
    viewDetails: 'devtools-blocks-view-{slug}',
    detail: {
      page: 'devtools-block-detail-{slug}',
      back: 'devtools-block-detail-back',
      tabPreview: 'devtools-block-detail-tab-preview',
      tabFields: 'devtools-block-detail-tab-fields',
      tabOverview: 'devtools-block-detail-tab-overview',
      preview: 'devtools-block-detail-preview-{slug}',
      exampleSelector: 'devtools-block-example-selector',
      exampleBtn: 'devtools-block-example-btn-{index}',
      exampleName: 'devtools-block-example-name',
      exampleDescription: 'devtools-block-example-description',
    },
  },
  tags: {
    page: 'devtools-tags-page',
    viewer: 'devtools-tags-viewer',
    search: 'devtools-tags-search',
    category: 'devtools-tags-category-{category}',
    tag: 'devtools-tags-tag-{tag}',
    tagLink: 'devtools-tags-link-{tag}',
    filesPanel: 'devtools-tags-files-panel-{tag}',
  },
  scheduledActions: {
    page: 'devtools-scheduled-actions-page',
    filterStatus: 'scheduled-actions-filter-status',
    filterType: 'scheduled-actions-filter-type',
    filterApply: 'scheduled-actions-filter-apply',
    filterReset: 'scheduled-actions-filter-reset',
    table: 'scheduled-actions-table',
    row: 'scheduled-actions-row-{id}',
    cellType: 'scheduled-actions-cell-type',
    cellStatus: 'scheduled-actions-cell-status',
    cellScheduledAt: 'scheduled-actions-cell-scheduled-at',
    cellTeam: 'scheduled-actions-cell-team',
    cellPayload: 'scheduled-actions-cell-payload',
    cellError: 'scheduled-actions-cell-error',
    cellActions: 'scheduled-actions-cell-actions',
    retryBtn: 'scheduled-actions-retry-btn-{id}',
    statusPending: 'scheduled-actions-status-pending',
    statusRunning: 'scheduled-actions-status-running',
    statusCompleted: 'scheduled-actions-status-completed',
    statusFailed: 'scheduled-actions-status-failed',
    pagination: 'scheduled-actions-pagination',
    paginationPrev: 'scheduled-actions-pagination-prev',
    paginationNext: 'scheduled-actions-pagination-next',
    emptyState: 'scheduled-actions-empty-state',
  },
  /**
   * API Explorer - Interactive API testing tool
   *
   * Layout:
   * ┌─────────────────────────────────────────────────────────────────┐
   * │ SIDEBAR          │ REQUEST PANEL        │ RESPONSE PANEL       │
   * │ ═══════════════  │ ════════════════════ │ ════════════════════ │
   * │ [Search...]      │ [Method] [URL]       │ Status: 200 OK       │
   * │                  │ [Send] [Cancel]      │ Time: 123ms          │
   * │ ▼ Category       │                      │                      │
   * │   ▼ Prefix       │ [Params] [Headers]   │ [Body] [Headers]     │
   * │     GET /path    │ [Body] [Presets]     │                      │
   * │     POST /path   │                      │ { response... }      │
   * │                  │ { body... }          │                      │
   * │                  │                      │                      │
   * │ ▼ Auth           │                      │                      │
   * │   [Session]      │                      │                      │
   * │   [API Key]      │                      │                      │
   * │                  │                      │                      │
   * │ ▼ Team           │                      │                      │
   * │   [Select team]  │                      │                      │
   * └─────────────────────────────────────────────────────────────────┘
   */
  apiExplorer: {
    container: 'devtools-api-explorer',
    mobileToggle: 'devtools-api-explorer-mobile-toggle',
    docsBtn: 'devtools-api-explorer-docs-btn',
    // Sidebar - endpoint navigation
    sidebar: {
      container: 'devtools-api-sidebar',
      collapsed: 'devtools-api-sidebar-collapsed',
      expand: 'devtools-api-sidebar-expand',
      collapse: 'devtools-api-sidebar-collapse',
      search: 'devtools-api-sidebar-search',
      category: 'devtools-api-sidebar-category-{category}',
      prefix: 'devtools-api-sidebar-prefix-{category}-{prefix}',
      endpoint: 'devtools-api-sidebar-endpoint-{method}-{path}',
    },
    // Auth selector
    auth: {
      container: 'devtools-api-auth',
      typeGroup: 'devtools-api-auth-type-group',
      sessionOption: 'devtools-api-auth-session',
      apiKeyOption: 'devtools-api-auth-apikey',
      apiKeyInput: 'devtools-api-auth-apikey-input',
      bypassToggle: 'devtools-api-auth-bypass-toggle',
    },
    // Team selector
    team: {
      container: 'devtools-api-team',
      loading: 'devtools-api-team-loading',
      trigger: 'devtools-api-team-trigger',
      option: 'devtools-api-team-option-{slug}',
      error: 'devtools-api-team-error',
      bypassTrigger: 'devtools-api-team-bypass-trigger',
      search: 'devtools-api-team-search',
      crossTeam: 'devtools-api-team-cross-team',
      bypassOption: 'devtools-api-team-bypass-option-{id}',
    },
    // Request panel
    request: {
      panel: 'devtools-api-request-panel',
      sendBtn: 'devtools-api-request-send',
      cancelBtn: 'devtools-api-request-cancel',
      tabParams: 'devtools-api-request-tab-params',
      tabHeaders: 'devtools-api-request-tab-headers',
      tabBody: 'devtools-api-request-tab-body',
      tabPresets: 'devtools-api-request-tab-presets',
    },
    // Response panel
    response: {
      panel: 'devtools-api-response-panel',
      panelIdle: 'devtools-api-response-idle',
      panelLoading: 'devtools-api-response-loading',
      panelError: 'devtools-api-response-error',
      status: 'devtools-api-response-status',
      time: 'devtools-api-response-time',
      tabBody: 'devtools-api-response-tab-body',
      tabHeaders: 'devtools-api-response-tab-headers',
      body: 'devtools-api-response-body',
      headers: 'devtools-api-response-headers',
    },
    // Presets tab
    presets: {
      tab: 'devtools-api-presets',
      empty: 'devtools-api-presets-empty',
      card: 'devtools-api-presets-card-{id}',
      viewBtn: 'devtools-api-presets-view-{id}',
      applyBtn: 'devtools-api-presets-apply-{id}',
    },
  },
} as const

export type DevtoolsSelectorsType = typeof DEVTOOLS_SELECTORS
