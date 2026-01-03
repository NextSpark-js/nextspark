/**
 * Entity Components
 *
 * Dynamic entity management components for CRUD operations
 */

// Core Components
export { EntityDetail } from './EntityDetail'
export { EntityForm } from './EntityForm'
export { EntityList } from './EntityList'
export { EntityTable } from './EntityTable'
export { EntityDetailPage } from './EntityDetailPage'

// Headers & Navigation
export { EntityDetailHeader } from './EntityDetailHeader'
export { EntityPageHeader } from './EntityPageHeader'
export { EntityNavigation, EntityNavigationSection, FullEntityNavigation } from './EntityNavigation'

// Field & Search
export { EntityFieldRenderer } from './EntityFieldRenderer'
export { EntitySearch, EntitySearchModal } from './EntitySearch'

// Bulk Actions & Child Management
export { EntityBulkActions } from './EntityBulkActions'
export { EntityChildManager } from './EntityChildManager'

// Error Handling
export { EntityErrorBoundary, useEntityErrorHandler, withEntityErrorBoundary } from './ErrorBoundary'

// Wrappers (re-export from subdirectory)
export {
  EntityFormWrapper,
  EntityListWrapper,
  EntityDetailWrapper,
} from './wrappers'

// Types
export type {
  EntityFormWrapperProps,
  EntityListWrapperProps,
  EntityDetailWrapperProps,
} from './wrappers'

export type { CustomSectionConfig, EntityDetailProps } from './EntityDetail'
export type { EntityFormProps } from './EntityForm'
export type { EntityDetailHeaderProps } from './EntityDetailHeader'
export type { EntityListProps } from './EntityList'
export type { EntityPageHeaderProps } from './EntityPageHeader'
export type { EntitySearchProps, SearchResult, SearchMatch, HighlightRange } from './EntitySearch'
export type { EntityChildManagerProps } from './EntityChildManager'
export type { EntityNavigationProps, EntityNavigationSectionProps, FullEntityNavigationProps } from './EntityNavigation'
export type { EntityFieldRendererProps } from './EntityFieldRenderer'
export type { EntityDetailPageProps } from './EntityDetailPage'

// Table Types
export type {
  EntityTableColumn,
  QuickAction,
  DropdownAction,
  PaginationConfig,
  SortConfig,
  EntityTableProps,
  StatusOption,
  BulkActionsConfig,
  EntityBulkActionsProps,
  ConfirmDialogState,
} from './entity-table.types'

export { generateColumnsFromConfig } from './entity-table.types'
