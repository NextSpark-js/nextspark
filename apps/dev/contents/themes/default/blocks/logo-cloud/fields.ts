import type { FieldDefinition } from '@nextsparkjs/core/types/blocks'
import {
  baseContentFields,
  baseDesignFields,
  baseAdvancedFields,
} from '@nextsparkjs/core/types/blocks'

/**
 * Logo Cloud Block Field Definitions
 *
 * Organized into 3 tabs:
 * - Content: title, content, cta (from base) + logos array
 * - Design: backgroundColor (from base) + layout, columns, grayscale, size
 * - Advanced: className, id (from base)
 */

// Logo Cloud-specific content fields
const logoCloudContentFields: FieldDefinition[] = [
  {
    name: 'logos',
    label: 'Logos',
    type: 'array',
    tab: 'content',
    required: true,
    description: 'List of client/partner logos to display',
    helpText: 'Add up to 20 logos with image, alt text, and optional link',
    minItems: 1,
    maxItems: 20,
    itemFields: [
      {
        name: 'image',
        label: 'Logo Image',
        type: 'image',
        tab: 'content',
        required: true,
        helpText: 'Logo image URL (recommended: transparent PNG, 200x100px)',
      },
      {
        name: 'alt',
        label: 'Alt Text',
        type: 'text',
        tab: 'content',
        required: true,
        placeholder: 'Company Name',
        helpText: 'Descriptive alt text for accessibility',
      },
      {
        name: 'url',
        label: 'Link URL (Optional)',
        type: 'url',
        tab: 'content',
        required: false,
        placeholder: 'https://example.com',
        helpText: 'Optional link when logo is clicked',
      },
    ],
  },
]

// Logo Cloud-specific design fields
const logoCloudDesignFields: FieldDefinition[] = [
  {
    name: 'layout',
    label: 'Layout',
    type: 'select',
    tab: 'design',
    required: false,
    default: 'grid',
    description: 'Layout style for logos',
    options: [
      { label: 'Grid', value: 'grid' },
      { label: 'Row (Wrap)', value: 'row' },
      { label: 'Row (Scroll)', value: 'row-scroll' },
    ],
  },
  {
    name: 'columns',
    label: 'Grid Columns',
    type: 'select',
    tab: 'design',
    required: false,
    default: '5',
    description: 'Number of columns in grid layout (desktop)',
    options: [
      { label: '3 Columns', value: '3' },
      { label: '4 Columns', value: '4' },
      { label: '5 Columns', value: '5' },
      { label: '6 Columns', value: '6' },
    ],
  },
  {
    name: 'grayscale',
    label: 'Grayscale Effect',
    type: 'checkbox',
    tab: 'design',
    required: false,
    default: true,
    description: 'Show logos in grayscale (color on hover)',
  },
  {
    name: 'size',
    label: 'Logo Size',
    type: 'select',
    tab: 'design',
    required: false,
    default: 'md',
    description: 'Size of logos',
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
  // Content tab: base fields + logo-cloud-specific
  ...baseContentFields,
  ...logoCloudContentFields,

  // Design tab: base fields + logo-cloud-specific
  ...baseDesignFields,
  ...logoCloudDesignFields,

  // Advanced tab: base fields only
  ...baseAdvancedFields,
]

// Alias for compatibility
export const fields = fieldDefinitions
