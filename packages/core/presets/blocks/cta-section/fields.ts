import type { FieldDefinition } from '@/core/types/blocks'
import {
  baseContentFields,
  baseDesignFields,
  baseAdvancedFields,
} from '@/core/types/blocks'

/**
 * CTA Section Block Field Definitions
 *
 * Organized into 3 tabs:
 * - Content: title, description, cta (from base) + secondaryButton
 * - Design: backgroundColor (from base)
 * - Advanced: className, id (from base)
 *
 * Note: The base CTA fields serve as the primary button
 */

// CTA-specific content fields (secondary button) - grouped in UI
const ctaContentFields: FieldDefinition[] = [
  {
    name: 'secondaryButton.text',
    label: 'Text',
    type: 'text',
    tab: 'content',
    required: false,
    placeholder: 'Learn More',
    helpText: 'Button text',
    group: 'secondaryButton',
    groupLabel: 'Secondary Button',
  },
  {
    name: 'secondaryButton.link',
    label: 'Link',
    type: 'url',
    tab: 'content',
    required: false,
    placeholder: '/about or https://...',
    helpText: 'URL the button links to',
    group: 'secondaryButton',
  },
  {
    name: 'secondaryButton.target',
    label: 'Open in',
    type: 'select',
    tab: 'content',
    required: false,
    default: '_self',
    helpText: 'How the link opens',
    group: 'secondaryButton',
    options: [
      { label: 'Same window', value: '_self' },
      { label: 'New tab', value: '_blank' },
    ],
  },
  {
    name: 'secondaryButton.variant',
    label: 'Style',
    type: 'select',
    tab: 'content',
    required: false,
    default: 'outline',
    helpText: 'Visual style of the button',
    group: 'secondaryButton',
    options: [
      { label: 'Default', value: 'default' },
      { label: 'Outline', value: 'outline' },
      { label: 'Ghost', value: 'ghost' },
    ],
  },
]

/**
 * Complete field definitions organized by tab
 */
export const fieldDefinitions: FieldDefinition[] = [
  // Content tab: base fields + cta-specific
  ...baseContentFields,
  ...ctaContentFields,

  // Design tab: base fields only
  ...baseDesignFields,

  // Advanced tab: base fields only
  ...baseAdvancedFields,
]

// Alias for compatibility
export const fields = fieldDefinitions
