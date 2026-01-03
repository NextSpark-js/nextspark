/**
 * Centralized type exports
 * Barrel file for easy importing across the application
 */

// Task related types
export type {
  Task,
  SearchableTask,
  TaskPriority,
  TaskCategory,
  TaskCategoryType,
  TaskUpdatePayload,
  TaskCreatePayload
} from './task.types'

export {
  TASK_PRIORITIES,
  TASK_CATEGORIES
} from './task.types'

// Testing and Accessibility types
export type {
  TestingProps,
  AccessibilityProps,
  ComponentTestingProps,
  KeyboardNavigationProps,
  FocusManagementProps,
  FullAccessibilityProps,
  TaskTestingProps,
  NavigationTestingProps,
  FormTestingProps,
  TestIdPattern,
  CypressIdPattern
} from './testing.types'

// User related types
export type {
  UserRole,
  User
} from './user.types'

export {
  USER_ROLES,
  ROLE_HIERARCHY,
  roleHelpers
} from './user.types'

// Meta data system types
export type {
  EntityType,
  MetaDataType,
  EntityConfig,
  EntityMeta,
  EntityWithMeta,
  CreateMetaPayload,
  UpdateMetaPayload,
  BulkMetaPayload,
  EntityResponse,
  MetaValue,
  KnownUserMetaKeys,
  UserResponse,
  DynamicEntityResponse,
} from './meta.types';

export { CORE_ENTITY_CONFIGS, getEntityMetaConfig, getMetaValue } from './meta.types';

// Block and Page system types
export type {
  FieldType,
  FieldDefinition,
  BlockCategory,
  BlockConfig,
  BlockInstance,
  PageMetadata,
  PageSEO,
  PageConfig,
  PageTemplate,
  BlockValidationResult,
  BlockRegistry,
  BlocksListResponse,
  BlockDetailResponse,
  BlockValidateRequest,
  BlockValidateResponse,
  PagesListResponse,
  PageDetailResponse,
  CreatePageRequest,
  UpdatePageRequest,
  ValidateSlugRequest,
  ValidateSlugResponse
} from './blocks'

export { isBlockInstance, isBlockConfig } from './blocks'

// Documentation registry types
export type {
  DocPageMeta,
  DocSectionMeta,
  DocsRegistryStructure
} from './docs'

// Future type exports can be added here:
// export type { SearchResult, SearchOptions } from './search.types'
// export type { Notification } from './notification.types'
