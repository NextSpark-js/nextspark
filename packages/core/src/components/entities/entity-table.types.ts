/**
 * EntityTable Type Definitions
 *
 * Shared types for EntityTable and EntityBulkActions components.
 * Migrated from team-manager theme DataTable with adaptations for entity system.
 */

import type { ReactNode } from 'react'
import type { EntityConfig, EntityField } from '../../lib/entities/types'

/**
 * Column definition for EntityTable
 * Extends EntityField with table-specific options
 */
export interface EntityTableColumn<T = Record<string, unknown>> {
  /** Field key (matches EntityField.name) */
  key: string
  /** Header text displayed in the table header */
  header: string
  /** Custom render function for cell content */
  render?: (item: T) => ReactNode
  /** Whether this column is sortable */
  sortable?: boolean
  /** Additional className for the column cells */
  className?: string
  /** Header className */
  headerClassName?: string
  /** Column width (CSS value) */
  width?: string
}

/**
 * Quick action shown on row hover (below the primary field)
 */
export interface QuickAction<T = Record<string, unknown>> {
  /** Action identifier */
  id: string
  /** Action label */
  label: string
  /** Icon element (Lucide icon recommended) */
  icon: ReactNode
  /** Click handler receiving the row item */
  onClick: (item: T) => void
  /** Visual variant - destructive shows in red */
  variant?: 'default' | 'destructive'
  /** Conditionally show this action based on item */
  visible?: (item: T) => boolean
  /** data-cy suffix for testing */
  dataCySuffix?: string
}

/**
 * Dropdown menu action (3-dot menu)
 */
export interface DropdownAction<T = Record<string, unknown>> {
  /** Action identifier */
  id: string
  /** Action label */
  label: string
  /** Icon element (Lucide icon recommended) */
  icon: ReactNode
  /** Click handler receiving the row item */
  onClick: (item: T) => void
  /** Visual variant - destructive shows in red */
  variant?: 'default' | 'destructive'
  /** Add separator line before this action */
  separator?: boolean
  /** Show confirmation dialog before executing */
  requiresConfirmation?: boolean
  /** Confirmation dialog title (can be function for dynamic text) */
  confirmationTitle?: string | ((item: T) => string)
  /** Confirmation dialog description (can be function for dynamic text) */
  confirmationDescription?: string | ((item: T) => string)
  /** Conditionally show this action based on item */
  visible?: (item: T) => boolean
  /** data-cy suffix for testing */
  dataCySuffix?: string
}

/**
 * Pagination configuration
 */
export interface PaginationConfig {
  /** Number of items per page */
  pageSize: number
  /** Current page (1-indexed) - controlled externally */
  currentPage?: number
  /** Total number of items (for server-side pagination) */
  totalItems?: number
  /** Callback when page changes */
  onPageChange?: (page: number) => void
  /** Show page size selector */
  showPageSizeSelector?: boolean
  /** Available page size options */
  pageSizeOptions?: number[]
  /** Callback when page size changes */
  onPageSizeChange?: (pageSize: number) => void
}

/**
 * Sort configuration
 */
export interface SortConfig {
  /** Field being sorted */
  field: string
  /** Sort direction */
  direction: 'asc' | 'desc'
}

/**
 * EntityTable component props
 */
export interface EntityTableProps<T extends { id: string } = { id: string }> {
  /** Entity configuration */
  entityConfig: EntityConfig
  /** Data array to display */
  data: T[]
  /** Custom column definitions (optional - auto-generated from entityConfig if not provided) */
  columns?: EntityTableColumn<T>[]

  // Selection
  /** Enable row selection with checkboxes */
  selectable?: boolean
  /** Controlled selected IDs (for external state management) */
  selectedIds?: Set<string>
  /** Callback when selection changes */
  onSelectionChange?: (ids: Set<string>) => void

  // Row interaction
  /** Handler for row click (navigates to detail) */
  onRowClick?: (item: T) => void
  /** Base path for navigation (default: /dashboard/{entitySlug}) */
  basePath?: string

  // Actions
  /** Quick actions shown on hover below primary column */
  quickActions?: QuickAction<T>[]
  /** Dropdown menu actions (3-dot menu) */
  dropdownActions?: DropdownAction<T>[]
  /** Use default actions based on entity permissions */
  useDefaultActions?: boolean

  // Pagination
  /** Pagination configuration. If provided, enables pagination */
  pagination?: PaginationConfig

  // Sorting
  /** Current sort configuration */
  currentSort?: SortConfig
  /** Callback when sort changes */
  onSort?: (field: string, direction: 'asc' | 'desc') => void

  // Search
  /** Current search query */
  searchQuery?: string
  /** Callback when search changes */
  onSearch?: (query: string) => void
  /** Enable search input */
  enableSearch?: boolean

  // Display helpers
  /** Function to get display name for confirmation dialogs */
  getItemName?: (item: T) => string
  /** Custom empty state content */
  emptyState?: ReactNode
  /** Show loading skeleton */
  loading?: boolean

  // Callbacks
  /** Callback when item is deleted */
  onDelete?: (id: string) => Promise<void>
  /** Get public URL for item (for builder entities) */
  getPublicUrl?: (item: T) => string | null

  // Styling
  /** Additional className for the table container */
  className?: string

  // Context
  /** Team ID for relation resolution */
  teamId?: string

  // Additional header content
  /** Additional actions to display in the header */
  headerActions?: ReactNode

  // Header visibility
  /** Show the built-in header (title, search, create button). Default: true */
  showHeader?: boolean
}

/**
 * Status option for bulk status change
 */
export interface StatusOption {
  value: string
  label: string
}

/**
 * Bulk actions configuration
 */
export interface BulkActionsConfig {
  /** Enable "Select All" action */
  enableSelectAll?: boolean
  /** Total items count for "Select All" */
  totalItems?: number
  /** Callback when "Select All" is clicked */
  onSelectAll?: () => void

  /** Enable "Change Status" action - requires statusOptions */
  enableChangeStatus?: boolean
  /** Available status options for bulk change */
  statusOptions?: StatusOption[]
  /** Callback when status change is confirmed */
  onChangeStatus?: (newStatus: string, selectedIds: string[]) => Promise<void> | void

  /** Enable "Delete" action */
  enableDelete?: boolean
  /** Callback when delete is confirmed */
  onDelete?: (selectedIds: string[]) => Promise<void> | void

  /** Custom label for items (singular) - default: "item" */
  itemLabel?: string
  /** Custom label for items (plural) - default: "items" */
  itemLabelPlural?: string
}

/**
 * EntityBulkActions component props
 */
export interface EntityBulkActionsProps {
  /** Entity slug for data-cy generation */
  entitySlug: string
  /** Currently selected item IDs */
  selectedIds: Set<string>
  /** Callback to clear selection */
  onClearSelection: () => void
  /** Bulk actions configuration */
  config: BulkActionsConfig
}

/**
 * Confirmation dialog state
 */
export interface ConfirmDialogState<T> {
  open: boolean
  item: T | null
  action: DropdownAction<T> | null
}

/**
 * Helper to generate columns from EntityConfig fields
 */
export function generateColumnsFromConfig<T extends Record<string, unknown>>(
  entityConfig: EntityConfig,
  options?: {
    excludeFields?: string[]
    includeOnly?: string[]
  }
): EntityTableColumn<T>[] {
  const { excludeFields = [], includeOnly } = options || {}

  return entityConfig.fields
    .filter((field: EntityField) => {
      // Must be shown in list
      if (!field.display.showInList) return false
      // Check excludeFields
      if (excludeFields.includes(field.name)) return false
      // Check includeOnly
      if (includeOnly && !includeOnly.includes(field.name)) return false
      return true
    })
    .sort((a: EntityField, b: EntityField) => a.display.order - b.display.order)
    .map((field: EntityField) => ({
      key: field.name,
      header: field.display.label,
      sortable: field.api.sortable,
      className: field.display.className,
    }))
}
