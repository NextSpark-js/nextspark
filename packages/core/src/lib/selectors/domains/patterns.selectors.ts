/**
 * Patterns Selectors
 *
 * Selectors for pattern-related components:
 * - Pattern usage table
 * - Pattern usage stats
 * - Pattern usage report
 * - Pattern delete dialog
 * - Deleted pattern placeholder
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * FIRST-LEVEL KEYS ORGANIZATION (5 keys)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 1. usageTable   - Pattern usage table component
 * 2. usageStats   - Pattern usage statistics cards
 * 3. usageReport  - Pattern usage report container with filters/pagination
 * 4. deleteDialog - Pattern delete confirmation dialog
 * 5. placeholder  - Deleted pattern placeholder in block editor
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export const PATTERNS_SELECTORS = {
  // ============================================
  // USAGE TABLE
  // ============================================
  usageTable: {
    container: 'pattern-usage-table',
    loading: 'pattern-usage-table-loading',
    empty: 'pattern-usage-table-empty',
    row: 'pattern-usage-row-{id}',
    viewLink: 'pattern-usage-view-{id}',
  },

  // ============================================
  // USAGE STATS
  // ============================================
  usageStats: {
    container: 'pattern-usage-stats',
    loading: 'pattern-usage-stats-loading',
    total: 'pattern-usage-stats-total',
    byType: 'pattern-usage-stats-{entityType}',
  },

  // ============================================
  // USAGE REPORT
  // ============================================
  usageReport: {
    container: 'pattern-usage-report',
    error: 'pattern-usage-report-error',
    filters: 'pattern-usage-filters',
    filterSelect: 'pattern-usage-filter-select',
    pagination: 'pattern-usage-pagination',
    prevPage: 'pattern-usage-prev-page',
    nextPage: 'pattern-usage-next-page',
    resultsInfo: 'pattern-usage-results-info',
  },

  // ============================================
  // DELETE DIALOG
  // ============================================
  deleteDialog: {
    trigger: 'pattern-delete-trigger',
    container: 'pattern-delete-dialog',
    loading: 'pattern-delete-loading',
    error: 'pattern-delete-error',
    warning: 'pattern-delete-warning',
    usageList: 'pattern-delete-usage-list',
    noUsage: 'pattern-delete-no-usage',
    cancel: 'pattern-delete-cancel',
    confirm: 'pattern-delete-confirm',
  },

  // ============================================
  // DELETED PATTERN PLACEHOLDER
  // ============================================
  placeholder: {
    container: 'deleted-pattern-placeholder',
    removeBtn: 'deleted-pattern-remove-btn',
  },
} as const

export type PatternsSelectorsType = typeof PATTERNS_SELECTORS
