import type { FieldDefinition } from '@nextsparkjs/core/types/blocks'
import {
  baseContentFields,
  baseDesignFields,
  baseAdvancedFields,
} from '@nextsparkjs/core/types/blocks'

/**
 * FAQ Accordion Block Field Definitions
 *
 * Organized into 3 tabs:
 * - Content: title (from base) + subtitle + items array
 * - Design: backgroundColor (from base) + allowMultiple + defaultOpenFirst + variant
 * - Advanced: className, id (from base)
 */

// FAQ-specific content fields
const faqContentFields: FieldDefinition[] = [
  {
    name: 'subtitle',
    label: 'Section Description',
    type: 'textarea',
    tab: 'content',
    required: false,
    placeholder: 'Find answers to commonly asked questions about our service...',
    helpText: 'Optional description displayed below the title',
    rows: 3,
  },
  {
    name: 'items',
    label: 'FAQ Items',
    type: 'array',
    tab: 'content',
    required: true,
    description: 'List of frequently asked questions and their answers',
    helpText: 'Add up to 20 FAQ items',
    minItems: 1,
    maxItems: 20,
    itemFields: [
      {
        name: 'question',
        label: 'Question',
        type: 'text',
        tab: 'content',
        required: true,
        placeholder: 'What is your return policy?',
        helpText: 'The question users are asking',
        maxLength: 200,
      },
      {
        name: 'answer',
        label: 'Answer',
        type: 'textarea',
        tab: 'content',
        required: true,
        placeholder: 'Our return policy allows you to return items within 30 days...',
        helpText: 'The answer to the question (supports basic formatting)',
        maxLength: 1000,
        rows: 4,
      },
    ],
  },
]

// FAQ-specific design fields
const faqDesignFields: FieldDefinition[] = [
  {
    name: 'allowMultiple',
    label: 'Allow Multiple Open',
    type: 'checkbox',
    tab: 'design',
    required: false,
    default: false,
    description: 'Allow multiple accordion items to be open at the same time',
    helpText: 'When disabled, opening one item will close others',
  },
  {
    name: 'defaultOpenFirst',
    label: 'First Item Open by Default',
    type: 'checkbox',
    tab: 'design',
    required: false,
    default: true,
    description: 'Automatically open the first FAQ item when the page loads',
  },
  {
    name: 'variant',
    label: 'Visual Style',
    type: 'select',
    tab: 'design',
    required: false,
    default: 'default',
    description: 'Choose the visual style variant for the accordion',
    options: [
      { label: 'Default', value: 'default' },
      { label: 'Bordered', value: 'bordered' },
      { label: 'Separated', value: 'separated' },
    ],
  },
]

/**
 * Complete field definitions organized by tab
 */
export const fieldDefinitions: FieldDefinition[] = [
  // Content tab: base fields + FAQ-specific
  ...baseContentFields,
  ...faqContentFields,

  // Design tab: base fields + FAQ-specific
  ...baseDesignFields,
  ...faqDesignFields,

  // Advanced tab: base fields only
  ...baseAdvancedFields,
]

// Alias for compatibility
export const fields = fieldDefinitions
