import type { FieldDefinition } from '@nextsparkjs/core/types/blocks'
import {
  baseContentFields,
  baseDesignFields,
  baseAdvancedFields,
} from '@nextsparkjs/core/types/blocks'

/**
 * Timeline Block Field Definitions
 *
 * Organized into 3 tabs:
 * - Content: title (from base), subtitle, items array
 * - Design: backgroundColor (from base), layout, alternating, showConnector, variant
 * - Advanced: className, id (from base)
 */

// Timeline-specific content fields
const timelineContentFields: FieldDefinition[] = [
  {
    name: 'subtitle',
    label: 'Subtitle',
    type: 'textarea',
    tab: 'content',
    required: false,
    placeholder: 'A brief description of the timeline...',
    helpText: 'Optional section description displayed below the title',
    rows: 2,
  },
  {
    name: 'items',
    label: 'Timeline Items',
    type: 'array',
    tab: 'content',
    required: true,
    description: 'Events or steps to display in the timeline',
    helpText: 'Add up to 20 timeline items with date, title, description, and optional icon',
    minItems: 1,
    maxItems: 20,
    itemFields: [
      {
        name: 'date',
        label: 'Date / Step',
        type: 'text',
        tab: 'content',
        required: true,
        placeholder: '2024, Step 1, Q1 2024',
        helpText: 'Date, step number, or time period label',
      },
      {
        name: 'title',
        label: 'Title',
        type: 'text',
        tab: 'content',
        required: true,
        placeholder: 'Event or milestone title',
        maxLength: 100,
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        tab: 'content',
        required: false,
        placeholder: 'Describe this event or step...',
        rows: 3,
      },
      {
        name: 'icon',
        label: 'Icon Name (optional)',
        type: 'text',
        tab: 'content',
        required: false,
        placeholder: 'Rocket, Check, Star, Calendar',
        helpText: 'Lucide icon name (optional)',
      },
    ],
  },
]

// Timeline-specific design fields
const timelineDesignFields: FieldDefinition[] = [
  {
    name: 'layout',
    label: 'Layout Direction',
    type: 'select',
    tab: 'design',
    required: false,
    default: 'vertical',
    description: 'Timeline orientation',
    helpText: 'Horizontal layout becomes vertical on mobile',
    options: [
      { label: 'Vertical', value: 'vertical' },
      { label: 'Horizontal', value: 'horizontal' },
    ],
  },
  {
    name: 'alternating',
    label: 'Alternating Sides',
    type: 'checkbox',
    tab: 'design',
    required: false,
    default: true,
    helpText: 'Alternate items between left and right (vertical layout only)',
  },
  {
    name: 'showConnector',
    label: 'Show Connector Line',
    type: 'checkbox',
    tab: 'design',
    required: false,
    default: true,
    helpText: 'Display line connecting timeline items',
  },
  {
    name: 'variant',
    label: 'Visual Style',
    type: 'select',
    tab: 'design',
    required: false,
    default: 'default',
    description: 'Timeline item appearance',
    options: [
      { label: 'Default', value: 'default' },
      { label: 'Minimal', value: 'minimal' },
      { label: 'Cards', value: 'cards' },
    ],
  },
]

/**
 * Complete field definitions organized by tab
 */
export const fieldDefinitions: FieldDefinition[] = [
  // Content tab: base fields + timeline-specific
  ...baseContentFields,
  ...timelineContentFields,

  // Design tab: base fields + timeline-specific
  ...baseDesignFields,
  ...timelineDesignFields,

  // Advanced tab: base fields only
  ...baseAdvancedFields,
]

// Alias for compatibility
export const fields = fieldDefinitions
