import type { FieldDefinition } from '@nextsparkjs/core/types/blocks'
import {
  baseContentFields,
  baseDesignFields,
  baseAdvancedFields,
} from '@nextsparkjs/core/types/blocks'

/**
 * Jumbotron Block Field Definitions
 *
 * Organized into 3 tabs:
 * - Content: title (from base) + subtitle, primaryCta, secondaryCta
 * - Design: backgroundColor (from base) + fullscreen, backgroundImage, textColor, textAlign
 * - Advanced: className, id (from base)
 */

// Filter out base content fields we don't need (content and cta)
const filteredBaseContentFields = baseContentFields.filter(
  field => field.name !== 'content' && field.name !== 'cta.text' && field.name !== 'cta.link' && field.name !== 'cta.target'
)

// Jumbotron-specific content fields
const jumbotronContentFields: FieldDefinition[] = [
  {
    name: 'subtitle',
    label: 'Subtitle',
    type: 'textarea',
    tab: 'content',
    required: false,
    placeholder: 'Supporting text or description',
    helpText: 'Optional subtitle text displayed below the main title',
  },
  // Primary CTA
  {
    name: 'primaryCta.text',
    label: 'Button Text',
    type: 'text',
    tab: 'content',
    required: false,
    placeholder: 'Get Started',
    helpText: 'Primary button text',
    group: 'primaryCta',
    groupLabel: 'Primary CTA',
  },
  {
    name: 'primaryCta.link',
    label: 'Link',
    type: 'url',
    tab: 'content',
    required: false,
    placeholder: '/signup or https://...',
    helpText: 'URL the button links to',
    group: 'primaryCta',
  },
  {
    name: 'primaryCta.target',
    label: 'Open in',
    type: 'select',
    tab: 'content',
    required: false,
    default: '_self',
    helpText: 'How the link opens',
    group: 'primaryCta',
    options: [
      { label: 'Same window', value: '_self' },
      { label: 'New tab', value: '_blank' },
    ],
  },
  {
    name: 'primaryCta.variant',
    label: 'Button Style',
    type: 'select',
    tab: 'content',
    required: false,
    default: 'default',
    helpText: 'Visual style of the primary button',
    group: 'primaryCta',
    options: [
      { label: 'Default', value: 'default' },
      { label: 'Outline', value: 'outline' },
      { label: 'Secondary', value: 'secondary' },
    ],
  },
  // Secondary CTA
  {
    name: 'secondaryCta.text',
    label: 'Button Text',
    type: 'text',
    tab: 'content',
    required: false,
    placeholder: 'Learn More',
    helpText: 'Secondary button text',
    group: 'secondaryCta',
    groupLabel: 'Secondary CTA',
  },
  {
    name: 'secondaryCta.link',
    label: 'Link',
    type: 'url',
    tab: 'content',
    required: false,
    placeholder: '/about or https://...',
    helpText: 'URL the button links to',
    group: 'secondaryCta',
  },
  {
    name: 'secondaryCta.target',
    label: 'Open in',
    type: 'select',
    tab: 'content',
    required: false,
    default: '_self',
    helpText: 'How the link opens',
    group: 'secondaryCta',
    options: [
      { label: 'Same window', value: '_self' },
      { label: 'New tab', value: '_blank' },
    ],
  },
  {
    name: 'secondaryCta.variant',
    label: 'Button Style',
    type: 'select',
    tab: 'content',
    required: false,
    default: 'outline',
    helpText: 'Visual style of the secondary button',
    group: 'secondaryCta',
    options: [
      { label: 'Default', value: 'default' },
      { label: 'Outline', value: 'outline' },
      { label: 'Secondary', value: 'secondary' },
    ],
  },
]

// Jumbotron-specific design fields
const jumbotronDesignFields: FieldDefinition[] = [
  {
    name: 'fullscreen',
    label: 'Fullscreen Mode',
    type: 'checkbox',
    tab: 'design',
    required: false,
    default: false,
    helpText: 'When enabled, block takes 100% of viewport height. When disabled, uses standard section padding.',
  },
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
  {
    name: 'textAlign',
    label: 'Text Alignment',
    type: 'select',
    tab: 'design',
    required: false,
    default: 'center',
    helpText: 'Horizontal alignment of content',
    options: [
      { label: 'Center', value: 'center' },
      { label: 'Left', value: 'left' },
      { label: 'Right', value: 'right' },
    ],
  },
]

/**
 * Complete field definitions organized by tab
 */
export const fieldDefinitions: FieldDefinition[] = [
  // Content tab: filtered base fields + jumbotron-specific
  ...filteredBaseContentFields,
  ...jumbotronContentFields,

  // Design tab: base fields + jumbotron-specific
  ...baseDesignFields,
  ...jumbotronDesignFields,

  // Advanced tab: base fields only
  ...baseAdvancedFields,
]

// Alias for compatibility
export const fields = fieldDefinitions
