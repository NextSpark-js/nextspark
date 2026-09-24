import type { FieldDefinition } from '@nextsparkjs/core/types/blocks'
import {
  baseContentFields,
  baseDesignFields,
  baseAdvancedFields,
} from '@nextsparkjs/core/types/blocks'

/**
 * Pricing Table Block Field Definitions
 *
 * Organized into 3 tabs:
 * - Content: title, content (from base) + plans array
 * - Design: backgroundColor (from base) + columns + highlightPopular
 * - Advanced: className, id (from base)
 */

// Pricing-specific content fields
const pricingContentFields: FieldDefinition[] = [
  {
    name: 'plans',
    label: 'Pricing Plans',
    type: 'array',
    tab: 'content',
    required: true,
    description: 'List of pricing plans to display',
    helpText: 'Add up to 4 pricing plans with features and CTA',
    minItems: 1,
    maxItems: 4,
    itemFields: [
      {
        name: 'name',
        label: 'Plan Name',
        type: 'text',
        tab: 'content',
        required: true,
        placeholder: 'Starter',
        maxLength: 50,
      },
      {
        name: 'price',
        label: 'Price',
        type: 'text',
        tab: 'content',
        required: true,
        placeholder: '$29',
        maxLength: 50,
        helpText: 'Price display (e.g., "$29", "Free", "$99")',
      },
      {
        name: 'period',
        label: 'Billing Period',
        type: 'text',
        tab: 'content',
        required: false,
        placeholder: '/month',
        maxLength: 50,
        helpText: 'Billing period (e.g., "/month", "/year", "one-time")',
      },
      {
        name: 'description',
        label: 'Plan Description',
        type: 'text',
        tab: 'content',
        required: false,
        placeholder: 'Perfect for getting started',
        maxLength: 200,
      },
      {
        name: 'features',
        label: 'Features (one per line)',
        type: 'textarea',
        tab: 'content',
        required: false,
        placeholder: 'Unlimited projects\n24/7 support\nAPI access',
        rows: 4,
        helpText: 'Enter each feature on a new line',
      },
      {
        name: 'ctaText',
        label: 'Button Text',
        type: 'text',
        tab: 'content',
        required: false,
        placeholder: 'Get Started',
        maxLength: 50,
      },
      {
        name: 'ctaUrl',
        label: 'Button Link',
        type: 'url',
        tab: 'content',
        required: false,
        placeholder: '/signup',
      },
      {
        name: 'isPopular',
        label: 'Mark as "Popular"',
        type: 'checkbox',
        tab: 'content',
        required: false,
        default: false,
        helpText: 'Show "Popular" badge on this plan',
      },
      {
        name: 'isDisabled',
        label: 'Disable this plan',
        type: 'checkbox',
        tab: 'content',
        required: false,
        default: false,
        helpText: 'Gray out this plan (coming soon, unavailable)',
      },
    ],
  },
]

// Pricing-specific design fields
const pricingDesignFields: FieldDefinition[] = [
  {
    name: 'columns',
    label: 'Grid Columns',
    type: 'select',
    tab: 'design',
    required: false,
    default: '3',
    description: 'Number of columns in the pricing table',
    options: [
      { label: '2 Columns', value: '2' },
      { label: '3 Columns', value: '3' },
      { label: '4 Columns', value: '4' },
    ],
  },
  {
    name: 'highlightPopular',
    label: 'Highlight Popular Plan',
    type: 'checkbox',
    tab: 'design',
    required: false,
    default: true,
    description: 'Add border and shadow to popular plan',
  },
]

/**
 * Complete field definitions organized by tab
 */
export const fieldDefinitions: FieldDefinition[] = [
  // Content tab: base fields + pricing-specific
  ...baseContentFields,
  ...pricingContentFields,

  // Design tab: base fields + pricing-specific
  ...baseDesignFields,
  ...pricingDesignFields,

  // Advanced tab: base fields only
  ...baseAdvancedFields,
]

// Alias for compatibility
export const fields = fieldDefinitions
