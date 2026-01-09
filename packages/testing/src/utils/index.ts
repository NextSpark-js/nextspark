/**
 * Utils Module
 *
 * Testing utility functions and helpers.
 */

export {
  // Types
  type TestIdPattern,
  type CypressIdPattern,
  // Basic generators
  createTestId,
  createCyId,
  // Attribute generators
  createStateAttr,
  createPriorityAttr,
  createTestingProps,
  createAriaLabel,
  // Patterns
  testingPatterns,
  // Keyboard helpers
  keyboardHelpers,
  // Entity helpers
  createEntityCyId,
  createEntityTestingHelper,
  type EntityTestingHelper,
} from './utils'
