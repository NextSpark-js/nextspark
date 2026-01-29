import type { FieldDefinition } from '@/core/types/blocks'
import {
  baseContentFields,
  baseDesignFields,
  baseAdvancedFields,
} from '@/core/types/blocks'

/**
 * Text Content Block Field Definitions
 *
 * Organized into 3 tabs:
 * - Content: title, cta (from base) + content (rich-text, replaces base content)
 * - Design: backgroundColor (from base) + maxWidth, alignment
 * - Advanced: className, id (from base)
 *
 * Note: The `content` field is overridden with a rich-text version
 */

// Filter out base content field (we'll replace it with rich-text version)
const baseContentFieldsWithoutContent = baseContentFields.filter(
  (field) => field.name !== 'content'
)

// Text-content-specific content fields (rich-text content)
const textContentFields: FieldDefinition[] = [
  {
    name: 'content',
    label: 'Content',
    type: 'rich-text',
    tab: 'content',
    required: true,
    placeholder: 'Enter your content here...',
    helpText: 'Rich text content with formatting support',
  },
]

// Text-content-specific design fields
const textDesignFields: FieldDefinition[] = [
  {
    name: 'maxWidth',
    label: 'Maximum Width',
    type: 'select',
    tab: 'design',
    required: false,
    default: 'lg',
    helpText: 'Maximum content width',
    options: [
      { label: 'Small (640px)', value: 'sm' },
      { label: 'Medium (768px)', value: 'md' },
      { label: 'Large (1024px)', value: 'lg' },
      { label: 'Extra Large (1280px)', value: 'xl' },
      { label: 'Full Width', value: 'full' },
    ],
  },
  {
    name: 'alignment',
    label: 'Text Alignment',
    type: 'select',
    tab: 'design',
    required: false,
    default: 'left',
    helpText: 'Text alignment within the content area',
    options: [
      { label: 'Left', value: 'left' },
      { label: 'Center', value: 'center' },
      { label: 'Right', value: 'right' },
    ],
  },
]

/**
 * Complete field definitions organized by tab
 */
export const fieldDefinitions: FieldDefinition[] = [
  // Content tab: base fields (without content) + rich-text content
  ...baseContentFieldsWithoutContent,
  ...textContentFields,

  // Design tab: base fields + text-specific
  ...baseDesignFields,
  ...textDesignFields,

  // Advanced tab: base fields only
  ...baseAdvancedFields,
]

// Alias for compatibility
export const fields = fieldDefinitions
