import type { FieldDefinition } from '@/core/types/blocks'
import {
  baseContentFields,
  baseDesignFields,
  baseAdvancedFields,
} from '@/core/types/blocks'

/**
 * Features Grid Block Field Definitions
 *
 * Organized into 3 tabs:
 * - Content: title, description, cta (from base) + items array
 * - Design: backgroundColor (from base) + columns
 * - Advanced: className, id (from base)
 */

// Features-specific content fields
const featuresContentFields: FieldDefinition[] = [
  {
    name: 'items',
    label: 'Features',
    type: 'array',
    tab: 'content',
    required: true,
    description: 'List of features to display in the grid',
    helpText: 'Add up to 12 features with icon, title, and description',
    minItems: 1,
    maxItems: 12,
    itemFields: [
      {
        name: 'icon',
        label: 'Icon Name',
        type: 'text',
        tab: 'content',
        required: true,
        placeholder: 'Zap',
        helpText: 'Lucide icon name (e.g., Zap, Shield, Star, Check)',
      },
      {
        name: 'title',
        label: 'Feature Title',
        type: 'text',
        tab: 'content',
        required: true,
        placeholder: 'Lightning Fast',
        maxLength: 100,
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        tab: 'content',
        required: true,
        placeholder: 'Describe this feature...',
        maxLength: 300,
        rows: 2,
      },
    ],
  },
]

// Features-specific design fields
const featuresDesignFields: FieldDefinition[] = [
  {
    name: 'columns',
    label: 'Grid Columns',
    type: 'select',
    tab: 'design',
    required: false,
    default: '3',
    description: 'Number of columns in the grid layout',
    options: [
      { label: '2 Columns', value: '2' },
      { label: '3 Columns', value: '3' },
      { label: '4 Columns', value: '4' },
    ],
  },
]

/**
 * Complete field definitions organized by tab
 */
export const fieldDefinitions: FieldDefinition[] = [
  // Content tab: base fields + features-specific
  ...baseContentFields,
  ...featuresContentFields,

  // Design tab: base fields + features-specific
  ...baseDesignFields,
  ...featuresDesignFields,

  // Advanced tab: base fields only
  ...baseAdvancedFields,
]

// Alias for compatibility
export const fields = fieldDefinitions
