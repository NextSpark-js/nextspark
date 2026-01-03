import type { FieldDefinition } from '@/core/types/blocks'
import {
  baseContentFields,
  baseDesignFields,
  baseAdvancedFields,
} from '@/core/types/blocks'

/**
 * Testimonials Block Field Definitions
 *
 * Organized into 3 tabs:
 * - Content: title, description, cta (from base) + items array
 * - Design: backgroundColor (from base) + columns
 * - Advanced: className, id (from base)
 */

// Testimonials-specific content fields
const testimonialsContentFields: FieldDefinition[] = [
  {
    name: 'items',
    label: 'Testimonials',
    type: 'array',
    tab: 'content',
    required: true,
    description: 'Customer testimonials to display',
    helpText: 'Add up to 6 testimonials',
    minItems: 1,
    maxItems: 6,
    itemFields: [
      {
        name: 'quote',
        label: 'Quote',
        type: 'textarea',
        tab: 'content',
        required: true,
        placeholder: 'This product changed my life...',
        maxLength: 500,
        rows: 3,
      },
      {
        name: 'author',
        label: 'Author Name',
        type: 'text',
        tab: 'content',
        required: true,
        placeholder: 'John Doe',
        maxLength: 100,
      },
      {
        name: 'role',
        label: 'Role/Title',
        type: 'text',
        tab: 'content',
        required: false,
        placeholder: 'CEO at Company',
        maxLength: 100,
      },
      {
        name: 'avatar',
        label: 'Avatar Image',
        type: 'image',
        tab: 'content',
        required: false,
        description: 'Profile picture of the person',
        helpText: 'Recommended size: 100x100px',
      },
    ],
  },
]

// Testimonials-specific design fields
const testimonialsDesignFields: FieldDefinition[] = [
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
    ],
  },
]

/**
 * Complete field definitions organized by tab
 */
export const fieldDefinitions: FieldDefinition[] = [
  // Content tab: base fields + testimonials-specific
  ...baseContentFields,
  ...testimonialsContentFields,

  // Design tab: base fields + testimonials-specific
  ...baseDesignFields,
  ...testimonialsDesignFields,

  // Advanced tab: base fields only
  ...baseAdvancedFields,
]

// Alias for compatibility
export const fields = fieldDefinitions
