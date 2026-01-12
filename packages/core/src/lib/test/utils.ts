/**
 * Testing Utilities
 * Helper functions for consistent testing attribute generation
 *
 * NOTE: For data-cy selectors, use sel() from '@nextsparkjs/core/selectors'
 * This file contains runtime utilities for accessibility and keyboard handling.
 */

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
