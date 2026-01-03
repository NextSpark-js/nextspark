import type { FieldDefinition } from '@/core/types/blocks'
import {
  baseContentFields,
  baseDesignFields,
  baseAdvancedFields,
} from '@/core/types/blocks'

/**
 * Hero Block Field Definitions
 *
 * Organized into 3 tabs:
 * - Content: title, content, cta (from base)
 * - Design: backgroundColor (from base) + backgroundImage, textColor
 * - Advanced: className, id (from base)
 *
 * Note: The `content` field from base serves as the hero subtitle/description
 */

// Hero-specific design fields
const heroDesignFields: FieldDefinition[] = [
  {
    name: 'backgroundImage',
    label: 'Background Image',
    type: 'image',
    tab: 'design',
    required: false,
    helpText: 'Optional background image (recommended: 1920x1080px minimum)',
  },
  {
    name: 'textColor',
    label: 'Text Color',
    type: 'select',
    tab: 'design',
    required: false,
    default: 'light',
    helpText: 'Choose text color based on background',
    options: [
      { label: 'Light (for dark backgrounds)', value: 'light' },
      { label: 'Dark (for light backgrounds)', value: 'dark' },
    ],
  },
]

/**
 * Complete field definitions organized by tab
 */
export const fieldDefinitions: FieldDefinition[] = [
  // Content tab: base fields only (title, content, cta)
  ...baseContentFields,

  // Design tab: base fields + hero-specific
  ...baseDesignFields,
  ...heroDesignFields,

  // Advanced tab: base fields only
  ...baseAdvancedFields,
]

// Alias for compatibility
export const fields = fieldDefinitions
