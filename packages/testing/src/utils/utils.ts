/**
 * Testing Utilities
 * Helper functions for consistent testing attribute generation
 */

// =============================================================================
// TYPE DEFINITIONS (inlined to avoid external dependency)
// =============================================================================

/**
 * Test ID pattern type
 */
export type TestIdPattern = string

/**
 * Cypress ID pattern type
 */
export type CypressIdPattern = string

// =============================================================================
// ENVIRONMENT DETECTION
// =============================================================================

/**
 * Environment-based testing mode
 */
const isDevelopment = process.env.NODE_ENV === 'development'
const isTest = process.env.NODE_ENV === 'test'
const enableTestingAttributes = isDevelopment || isTest

// =============================================================================
// BASIC TEST ID GENERATORS
// =============================================================================

/**
 * Create consistent test IDs following the pattern: [component]-[element]-[action?]
 *
 * @param component - Main component name (e.g., 'task', 'nav', 'user')
 * @param element - Element type (e.g., 'card', 'button', 'input')
 * @param action - Optional action (e.g., 'delete', 'edit', 'toggle')
 * @returns Test ID string or undefined in production
 */
export function createTestId(
  component: string,
  element: string,
  action?: string
): string | undefined {
  if (!enableTestingAttributes) return undefined

  const parts = [component, element, action].filter(Boolean)
  return parts.join('-') as TestIdPattern
}

/**
 * Create Cypress-specific IDs following the pattern: [domain]-[element]
 *
 * @param domain - Application domain (e.g., 'todo', 'nav', 'user')
 * @param element - Element identifier (e.g., 'item', 'button', 'menu')
 * @returns Cypress ID string or undefined in production
 */
export function createCyId(domain: string, element: string): string | undefined {
  if (!enableTestingAttributes) return undefined

  return `${domain}-${element}` as CypressIdPattern
}

// =============================================================================
// ATTRIBUTE GENERATORS
// =============================================================================

/**
 * Create state-based data attributes for conditional testing
 *
 * @param state - Current state value
 * @returns State attribute value
 */
export function createStateAttr(
  state: 'active' | 'completed' | 'pending' | 'loading' | 'error'
): string {
  return state
}

/**
 * Create priority-based data attributes
 *
 * @param priority - Priority level
 * @returns Priority attribute value
 */
export function createPriorityAttr(priority: 'low' | 'medium' | 'high'): string {
  return priority
}

/**
 * Generate testing props object for components
 *
 * @param config - Testing configuration
 * @returns Testing props object
 */
export function createTestingProps(config: {
  testId?: string
  cyId?: string
  state?: 'active' | 'completed' | 'pending' | 'loading' | 'error'
  priority?: 'low' | 'medium' | 'high'
  taskId?: string
  userId?: string
}) {
  const props: Record<string, string | undefined> = {}

  if (config.testId) {
    props['data-testid'] = enableTestingAttributes ? config.testId : undefined
  }

  if (config.cyId) {
    props['data-cy'] = enableTestingAttributes ? config.cyId : undefined
  }

  if (config.state) {
    props['data-state'] = config.state
  }

  if (config.priority) {
    props['data-priority'] = config.priority
  }

  if (config.taskId) {
    props['data-task-id'] = config.taskId
  }

  if (config.userId) {
    props['data-user-id'] = config.userId
  }

  // Filter out undefined values
  return Object.fromEntries(
    Object.entries(props).filter((entry) => entry[1] !== undefined)
  )
}

/**
 * Accessibility helper for dynamic aria-label generation
 *
 * @param template - Label template with placeholders
 * @param values - Values to replace placeholders
 * @returns Formatted aria-label
 */
export function createAriaLabel(
  template: string,
  values: Record<string, string | number | boolean>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return String(values[key] ?? match)
  })
}

// =============================================================================
// TESTING PATTERNS
// =============================================================================

/**
 * Common testing patterns for different component types
 */
export const testingPatterns = {
  // Task/Todo components
  task: {
    card: (taskId: string) =>
      createTestingProps({
        testId: createTestId('task', 'card'),
        cyId: createCyId('task', 'item'),
        taskId,
      }),
    checkbox: () =>
      createTestingProps({
        testId: createTestId('task', 'checkbox'),
        cyId: createCyId('task', 'toggle'),
      }),
    title: () =>
      createTestingProps({
        testId: createTestId('task', 'title'),
        cyId: createCyId('task', 'title'),
      }),
    deleteButton: () =>
      createTestingProps({
        testId: createTestId('task', 'delete', 'button'),
        cyId: createCyId('task', 'delete'),
      }),
  },

  // Navigation components
  nav: {
    searchDropdown: () =>
      createTestingProps({
        testId: createTestId('nav', 'search', 'dropdown'),
        cyId: createCyId('nav', 'search'),
      }),
    notifications: () =>
      createTestingProps({
        testId: createTestId('nav', 'notifications', 'button'),
        cyId: createCyId('nav', 'notifications'),
      }),
    userMenu: () =>
      createTestingProps({
        testId: createTestId('nav', 'user', 'menu'),
        cyId: createCyId('nav', 'user-menu'),
      }),
  },

  // Form components
  form: {
    input: (fieldName: string) =>
      createTestingProps({
        testId: createTestId('form', fieldName, 'input'),
        cyId: createCyId('form', fieldName),
      }),
    submitButton: () =>
      createTestingProps({
        testId: createTestId('form', 'submit', 'button'),
        cyId: createCyId('form', 'submit'),
      }),
  },
}

// =============================================================================
// KEYBOARD HELPERS
// =============================================================================

/**
 * Keyboard navigation helpers
 */
export const keyboardHelpers = {
  /**
   * Handle Enter and Space key activation
   */
  createActivationHandler: (onActivate: () => void) => {
    return (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onActivate()
      }
    }
  },

  /**
   * Handle Escape key for closing
   */
  createEscapeHandler: (onClose: () => void) => {
    return (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
  },

  /**
   * Handle arrow navigation in lists
   */
  createArrowNavigationHandler: (
    currentIndex: number,
    maxIndex: number,
    onIndexChange: (index: number) => void
  ) => {
    return (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          onIndexChange(currentIndex < maxIndex ? currentIndex + 1 : 0)
          break
        case 'ArrowUp':
          e.preventDefault()
          onIndexChange(currentIndex > 0 ? currentIndex - 1 : maxIndex)
          break
      }
    }
  },
}

// ============================================================================
// ENTITY TESTING HELPERS
// ============================================================================

/**
 * Create entity-specific Cypress ID following the convention: {slug}-{component}-{detail?}
 *
 * @param entitySlug - Entity slug from config (e.g., 'squads', 'people', 'projects')
 * @param component - Component type (e.g., 'form', 'field', 'section', 'table')
 * @param detail - Optional detail (e.g., field name, section name, action)
 * @returns Cypress ID string or undefined in production
 *
 * @example
 * createEntityCyId('squads', 'form')           // 'squads-form'
 * createEntityCyId('squads', 'field', 'name')  // 'squads-field-name'
 * createEntityCyId('squads', 'form', 'submit') // 'squads-form-submit'
 */
export function createEntityCyId(
  entitySlug: string,
  component: string,
  detail?: string
): string | undefined {
  if (!enableTestingAttributes) return undefined

  const parts = [entitySlug, component, detail].filter(Boolean)
  return parts.join('-')
}

/**
 * Entity testing helper interface
 */
export interface EntityTestingHelper {
  /** Generic selector: {slug}-{component}-{detail?} - Use for custom/non-standard selectors */
  get: (component: string, detail?: string) => string | undefined

  // Page selectors
  /** {slug}-page */
  page: () => string | undefined
  /** {slug}-form-page */
  formPage: () => string | undefined

  // Form selectors
  /** {slug}-form */
  form: () => string | undefined
  /** {slug}-form-submit */
  formSubmit: () => string | undefined
  /** {slug}-form-cancel */
  formCancel: () => string | undefined

  // Field selectors
  /** {slug}-field-{name} */
  field: (name: string) => string | undefined
  /** {slug}-field-{name}-option-{value} */
  fieldOption: (name: string, value: string) => string | undefined
  /** {slug}-field-{name}-error */
  fieldError: (name: string) => string | undefined

  // Section selectors
  /** {slug}-section-{name} */
  section: (name: string) => string | undefined

  // Card selectors
  /** {slug}-card-{id} */
  card: (id: string) => string | undefined

  // List/Table selectors
  /** {slug}-table */
  table: () => string | undefined
  /** {slug}-row-{id} */
  row: (id: string) => string | undefined
  /** {slug}-create-btn */
  createBtn: () => string | undefined
  /** {slug}-search-input */
  searchInput: () => string | undefined

  // Filter selectors
  /** {slug}-filter-{field} */
  filter: (field: string) => string | undefined
  /** {slug}-filter-{field}-trigger */
  filterTrigger: (field: string) => string | undefined
  /** {slug}-filter-{field}-option-{value} */
  filterOption: (field: string, value: string) => string | undefined

  // Action selectors
  /** {slug}-action-{action}-{id} */
  action: (action: string, id: string) => string | undefined
  /** {slug}-actions-trigger-{id} */
  actionsTrigger: (id: string) => string | undefined

  // Dialog selectors
  /** {slug}-confirm-delete */
  confirmDelete: () => string | undefined
  /** {slug}-confirm-delete-btn */
  confirmDeleteBtn: () => string | undefined
  /** {slug}-cancel-delete-btn */
  cancelDeleteBtn: () => string | undefined
}

/**
 * Create a testing helper factory for a specific entity.
 * Uses the entity slug from config to generate consistent data-cy selectors.
 *
 * Convention: {slug}-{component}-{detail}
 *
 * @param entitySlug - Entity slug from EntityConfig (e.g., 'squads', 'people')
 * @returns EntityTestingHelper with pre-bound selector generators
 *
 * @example
 * // In your component file:
 * import { createEntityTestingHelper } from '@nextsparkjs/testing/utils'
 * import { squadsEntityConfig } from './squads.config'
 *
 * const testId = createEntityTestingHelper(squadsEntityConfig.slug)
 *
 * // Usage in JSX:
 * <div data-cy={testId.formPage()}>           // squads-form-page
 *   <form data-cy={testId.form()}>            // squads-form
 *     <div data-cy={testId.section('basic')}> // squads-section-basic
 *       <input data-cy={testId.field('name')} /> // squads-field-name
 *     </div>
 *     <button data-cy={testId.formSubmit()}>  // squads-form-submit
 *       Submit
 *     </button>
 *   </form>
 * </div>
 *
 * // Card example:
 * <Card data-cy={testId.card(squad.id)}>     // squads-card-{id}
 *
 * // Custom selector example (for non-standard selectors):
 * <div data-cy={testId.get('color-preset', color)}>  // squads-color-preset-{color}
 */
export function createEntityTestingHelper(entitySlug: string): EntityTestingHelper {
  return {
    // Generic (framework-agnostic)
    get: (component: string, detail?: string) =>
      createEntityCyId(entitySlug, component, detail),

    // Page
    page: () => createEntityCyId(entitySlug, 'page'),
    formPage: () => createEntityCyId(entitySlug, 'form-page'),

    // Form
    form: () => createEntityCyId(entitySlug, 'form'),
    formSubmit: () => createEntityCyId(entitySlug, 'form-submit'),
    formCancel: () => createEntityCyId(entitySlug, 'form-cancel'),

    // Fields
    field: (name: string) => createEntityCyId(entitySlug, 'field', name),
    fieldOption: (name: string, value: string) =>
      createEntityCyId(entitySlug, `field-${name}-option`, value),
    fieldError: (name: string) => createEntityCyId(entitySlug, `field-${name}`, 'error'),

    // Sections
    section: (name: string) => createEntityCyId(entitySlug, 'section', name),

    // Card
    card: (id: string) => createEntityCyId(entitySlug, 'card', id),

    // List/Table
    table: () => createEntityCyId(entitySlug, 'table'),
    row: (id: string) => createEntityCyId(entitySlug, 'row', id),
    createBtn: () => createEntityCyId(entitySlug, 'create-btn'),
    searchInput: () => createEntityCyId(entitySlug, 'search-input'),

    // Filters
    filter: (field: string) => createEntityCyId(entitySlug, 'filter', field),
    filterTrigger: (field: string) =>
      createEntityCyId(entitySlug, `filter-${field}`, 'trigger'),
    filterOption: (field: string, value: string) =>
      createEntityCyId(entitySlug, `filter-${field}-option`, value),

    // Actions
    action: (action: string, id: string) =>
      createEntityCyId(entitySlug, `action-${action}`, id),
    actionsTrigger: (id: string) => createEntityCyId(entitySlug, 'actions-trigger', id),

    // Dialogs
    confirmDelete: () => createEntityCyId(entitySlug, 'confirm-delete'),
    confirmDeleteBtn: () => createEntityCyId(entitySlug, 'confirm-delete-btn'),
    cancelDeleteBtn: () => createEntityCyId(entitySlug, 'cancel-delete-btn'),
  }
}
