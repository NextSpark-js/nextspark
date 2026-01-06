import type { FieldDefinition } from '@nextsparkjs/core/types/blocks'
import {
  baseDesignFields,
  baseAdvancedFields,
} from '@nextsparkjs/core/types/blocks'

/**
 * Split Content Block Field Definitions
 *
 * Organized into 3 tabs:
 * - Content: subtitle, title, content, image, imageAlt, bulletPoints, cta
 * - Design: backgroundColor (from base) + imagePosition, imageStyle, verticalAlign
 * - Advanced: className, id (from base)
 */

// Split Content specific content fields
const splitContentFields: FieldDefinition[] = [
  {
    name: 'subtitle',
    label: 'Subtitle',
    type: 'text',
    tab: 'content',
    required: false,
    placeholder: 'Eyebrow text',
    helpText: 'Optional label or eyebrow text above the title',
  },
  {
    name: 'title',
    label: 'Title',
    type: 'text',
    tab: 'content',
    required: false,
    placeholder: 'Main headline',
    helpText: 'Main section headline',
  },
  {
    name: 'content',
    label: 'Content',
    type: 'textarea',
    tab: 'content',
    required: false,
    placeholder: 'Main description text...',
    helpText: 'Main text content/description',
    rows: 4,
  },
  {
    name: 'image',
    label: 'Image',
    type: 'image',
    tab: 'content',
    required: true,
    helpText: 'Featured image (recommended: 800x600px minimum)',
  },
  {
    name: 'imageAlt',
    label: 'Image Alt Text',
    type: 'text',
    tab: 'content',
    required: false,
    placeholder: 'Describe the image',
    helpText: 'Alternative text for accessibility',
  },
  {
    name: 'bulletPoints',
    label: 'Bullet Points',
    type: 'array',
    tab: 'content',
    required: false,
    description: 'Optional list of bullet points',
    helpText: 'Add up to 10 bullet points',
    maxItems: 10,
    itemFields: [
      {
        name: 'text',
        label: 'Bullet Point',
        type: 'text',
        tab: 'content',
        required: true,
        placeholder: 'Bullet point text',
        maxLength: 200,
      },
    ],
  },
  {
    name: 'cta',
    label: 'Call to Action',
    type: 'text',
    tab: 'content',
    required: false,
    description: 'Optional CTA button',
    helpText: 'Configure button text, link, target, and variant',
  },
  {
    name: 'cta.text',
    label: 'CTA Text',
    type: 'text',
    tab: 'content',
    required: false,
    placeholder: 'Get Started',
  },
  {
    name: 'cta.link',
    label: 'CTA Link',
    type: 'url',
    tab: 'content',
    required: false,
    placeholder: 'https://example.com or /path',
  },
  {
    name: 'cta.target',
    label: 'CTA Target',
    type: 'select',
    tab: 'content',
    required: false,
    default: '_self',
    options: [
      { label: 'Same Window', value: '_self' },
      { label: 'New Window', value: '_blank' },
    ],
  },
  {
    name: 'cta.variant',
    label: 'CTA Variant',
    type: 'select',
    tab: 'content',
    required: false,
    default: 'default',
    helpText: 'Button style variant',
    options: [
      { label: 'Default', value: 'default' },
      { label: 'Outline', value: 'outline' },
      { label: 'Secondary', value: 'secondary' },
    ],
  },
]

// Split Content specific design fields
const splitContentDesignFields: FieldDefinition[] = [
  {
    name: 'imagePosition',
    label: 'Image Position',
    type: 'select',
    tab: 'design',
    required: false,
    default: 'left',
    description: 'Position of the image in the layout',
    options: [
      { label: 'Left', value: 'left' },
      { label: 'Right', value: 'right' },
    ],
  },
  {
    name: 'imageStyle',
    label: 'Image Style',
    type: 'select',
    tab: 'design',
    required: false,
    default: 'rounded',
    description: 'Image corner style',
    options: [
      { label: 'Square', value: 'square' },
      { label: 'Rounded', value: 'rounded' },
      { label: 'Circle', value: 'circle' },
    ],
  },
  {
    name: 'verticalAlign',
    label: 'Vertical Alignment',
    type: 'select',
    tab: 'design',
    required: false,
    default: 'center',
    description: 'Vertical alignment of content',
    options: [
      { label: 'Top', value: 'top' },
      { label: 'Center', value: 'center' },
      { label: 'Bottom', value: 'bottom' },
    ],
  },
]

/**
 * Complete field definitions organized by tab
 */
export const fieldDefinitions: FieldDefinition[] = [
  // Content tab: split-content specific fields
  ...splitContentFields,

  // Design tab: base fields + split-content specific
  ...baseDesignFields,
  ...splitContentDesignFields,

  // Advanced tab: base fields only
  ...baseAdvancedFields,
]

// Alias for compatibility
export const fields = fieldDefinitions
