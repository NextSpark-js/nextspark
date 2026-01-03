import type { FieldDefinition } from '@nextsparkjs/core/types/blocks'
import {
  baseContentFields,
  baseDesignFields,
  baseAdvancedFields,
} from '@nextsparkjs/core/types/blocks'

/**
 * Stats Counter Block Field Definitions
 *
 * Organized into 3 tabs:
 * - Content: title, content, cta (from base) + stats array
 * - Design: backgroundColor (from base) + columns, variant, size
 * - Advanced: className, id (from base)
 */

// Stats-specific content fields
const statsContentFields: FieldDefinition[] = [
  {
    name: 'stats',
    label: 'Statistics',
    type: 'array',
    tab: 'content',
    required: true,
    description: 'List of statistics to display',
    helpText: 'Add up to 8 statistics with values and labels',
    minItems: 1,
    maxItems: 8,
    itemFields: [
      {
        name: 'value',
        label: 'Value',
        type: 'text',
        tab: 'content',
        required: true,
        placeholder: '10,000+',
        helpText: 'The number or metric value (e.g., "10,000+", "99%", "$1M+")',
      },
      {
        name: 'label',
        label: 'Label',
        type: 'text',
        tab: 'content',
        required: true,
        placeholder: 'Happy Customers',
        helpText: 'Description of the statistic',
        maxLength: 100,
      },
      {
        name: 'prefix',
        label: 'Prefix',
        type: 'text',
        tab: 'content',
        required: false,
        placeholder: '$',
        helpText: 'Optional prefix (e.g., "$", "+")',
      },
      {
        name: 'suffix',
        label: 'Suffix',
        type: 'text',
        tab: 'content',
        required: false,
        placeholder: '+',
        helpText: 'Optional suffix (e.g., "%", "+", "K")',
      },
    ],
  },
]

// Stats-specific design fields
const statsDesignFields: FieldDefinition[] = [
  {
    name: 'columns',
    label: 'Grid Columns',
    type: 'select',
    tab: 'design',
    required: false,
    default: '4',
    description: 'Number of columns in the grid layout',
    options: [
      { label: '2 Columns', value: '2' },
      { label: '3 Columns', value: '3' },
      { label: '4 Columns', value: '4' },
    ],
  },
  {
    name: 'variant',
    label: 'Style Variant',
    type: 'select',
    tab: 'design',
    required: false,
    default: 'default',
    description: 'Visual style of the statistics',
    options: [
      { label: 'Default', value: 'default' },
      { label: 'Cards (with background)', value: 'cards' },
      { label: 'Minimal (text only)', value: 'minimal' },
    ],
  },
  {
    name: 'size',
    label: 'Number Size',
    type: 'select',
    tab: 'design',
    required: false,
    default: 'md',
    description: 'Size of the statistic numbers',
    options: [
      { label: 'Small', value: 'sm' },
      { label: 'Medium', value: 'md' },
      { label: 'Large', value: 'lg' },
    ],
  },
]

/**
 * Complete field definitions organized by tab
 */
export const fieldDefinitions: FieldDefinition[] = [
  // Content tab: base fields + stats-specific
  ...baseContentFields,
  ...statsContentFields,

  // Design tab: base fields + stats-specific
  ...baseDesignFields,
  ...statsDesignFields,

  // Advanced tab: base fields only
  ...baseAdvancedFields,
]

// Alias for compatibility
export const fields = fieldDefinitions
