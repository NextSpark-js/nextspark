import type { FieldDefinition } from '@nextsparkjs/core/types/blocks'
import {
  baseContentFields,
  baseDesignFields,
  baseAdvancedFields,
} from '@nextsparkjs/core/types/blocks'

/**
 * Post Content Block Field Definitions
 *
 * Organized into 3 tabs:
 * - Content: title, cta (from base) + content (rich-text, replaces base content)
 * - Design: backgroundColor (from base) + editorial typography options
 * - Advanced: className, id (from base)
 *
 * Note: The `content` field is overridden with a rich-text version for editorial content
 */

// Filter out base content field (we'll replace it with rich-text version)
const baseContentFieldsWithoutContent = baseContentFields.filter(
  (field) => field.name !== 'content'
)

// Post-content-specific content fields (rich-text content)
const postContentFields: FieldDefinition[] = [
  {
    name: 'content',
    label: 'Article Content',
    type: 'rich-text',
    tab: 'content',
    required: true,
    placeholder: 'Write your article content here...',
    helpText: 'Main article body with rich text formatting support',
  },
]

// Post-content-specific design fields (editorial styling)
const postDesignFields: FieldDefinition[] = [
  // Drop cap section
  {
    name: 'showDropCap',
    label: 'Show Drop Cap',
    type: 'checkbox',
    tab: 'design',
    required: false,
    default: false,
    helpText: 'Display a decorative large first letter',
  },
  {
    name: 'dropCapStyle',
    label: 'Drop Cap Style',
    type: 'select',
    tab: 'design',
    required: false,
    default: 'serif',
    helpText: 'Visual style for the drop cap',
    options: [
      { label: 'Serif (Classic)', value: 'serif' },
      { label: 'Sans-Serif (Modern)', value: 'sans-serif' },
      { label: 'Decorative', value: 'decorative' },
    ],
  },

  // Typography section
  {
    name: 'maxWidth',
    label: 'Reading Width',
    type: 'select',
    tab: 'design',
    required: false,
    default: 'narrow',
    helpText: 'Optimal reading width for long-form content',
    options: [
      { label: 'Narrow (680px) - Optimal for reading', value: 'narrow' },
      { label: 'Medium (768px)', value: 'medium' },
      { label: 'Wide (900px)', value: 'wide' },
    ],
  },
  {
    name: 'fontSize',
    label: 'Base Font Size',
    type: 'select',
    tab: 'design',
    required: false,
    default: 'medium',
    helpText: 'Base font size for article text',
    options: [
      { label: 'Small (16px)', value: 'small' },
      { label: 'Medium (18px) - Recommended', value: 'medium' },
      { label: 'Large (20px)', value: 'large' },
    ],
  },
  {
    name: 'lineHeight',
    label: 'Line Spacing',
    type: 'select',
    tab: 'design',
    required: false,
    default: 'relaxed',
    helpText: 'Vertical spacing between lines',
    options: [
      { label: 'Compact (1.6)', value: 'compact' },
      { label: 'Normal (1.7)', value: 'normal' },
      { label: 'Relaxed (1.8) - Recommended', value: 'relaxed' },
    ],
  },
  {
    name: 'paragraphSpacing',
    label: 'Paragraph Spacing',
    type: 'select',
    tab: 'design',
    required: false,
    default: 'normal',
    helpText: 'Vertical spacing between paragraphs',
    options: [
      { label: 'Tight', value: 'tight' },
      { label: 'Normal', value: 'normal' },
      { label: 'Loose', value: 'loose' },
    ],
  },

  // Dividers section
  {
    name: 'showDividers',
    label: 'Show Section Dividers',
    type: 'checkbox',
    tab: 'design',
    required: false,
    default: false,
    helpText: 'Display subtle dividers between content sections',
  },
  {
    name: 'dividerStyle',
    label: 'Divider Style',
    type: 'select',
    tab: 'design',
    required: false,
    default: 'line',
    helpText: 'Visual style for section dividers',
    options: [
      { label: 'Line', value: 'line' },
      { label: 'Dots (•••)', value: 'dots' },
      { label: 'Asterisks (***)', value: 'asterisks' },
    ],
  },
]

/**
 * Complete field definitions organized by tab
 */
export const fieldDefinitions: FieldDefinition[] = [
  // Content tab: base fields (without content) + rich-text content
  ...baseContentFieldsWithoutContent,
  ...postContentFields,

  // Design tab: base fields + editorial-specific
  ...baseDesignFields,
  ...postDesignFields,

  // Advanced tab: base fields only (ALWAYS last)
  ...baseAdvancedFields,
]

// Alias for compatibility
export const fields = fieldDefinitions
