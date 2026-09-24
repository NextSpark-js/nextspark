import type { FieldDefinition } from '@nextsparkjs/core/types/blocks'
import {
  baseDesignFields,
  baseAdvancedFields,
} from '@nextsparkjs/core/types/blocks'

/**
 * Hero With Form Block Field Definitions
 *
 * Organized into 3 tabs:
 * - Content: title, subtitle, backgroundImage, form fields
 * - Design: backgroundColor (from base) + overlayOpacity
 * - Advanced: className, id (from base)
 */

// Hero with form content fields
const heroWithFormContentFields: FieldDefinition[] = [
  {
    name: 'title',
    label: 'Main Headline',
    type: 'text',
    tab: 'content',
    required: true,
    helpText: 'Main hero headline (appears on left side)',
  },
  {
    name: 'subtitle',
    label: 'Subtitle',
    type: 'textarea',
    tab: 'content',
    required: false,
    helpText: 'Supporting text below the headline',
  },
  {
    name: 'backgroundImage',
    label: 'Background Image',
    type: 'media-library',
    tab: 'content',
    required: true,
    helpText: 'Full-width background image (recommended: 1920x1080px minimum)',
  },
  {
    name: 'formTitle',
    label: 'Form Title',
    type: 'text',
    tab: 'content',
    required: false,
    default: 'Get Started',
    helpText: 'Title displayed at the top of the form card',
  },
  {
    name: 'formSubtitle',
    label: 'Form Subtitle',
    type: 'text',
    tab: 'content',
    required: false,
    helpText: 'Optional subtitle below form title',
  },
  {
    name: 'firstNamePlaceholder',
    label: 'First Name Placeholder',
    type: 'text',
    tab: 'content',
    required: false,
    default: 'First Name',
  },
  {
    name: 'lastNamePlaceholder',
    label: 'Last Name Placeholder',
    type: 'text',
    tab: 'content',
    required: false,
    default: 'Last Name',
  },
  {
    name: 'emailPlaceholder',
    label: 'Email Placeholder',
    type: 'text',
    tab: 'content',
    required: false,
    default: 'Email',
  },
  {
    name: 'phonePlaceholder',
    label: 'Phone Placeholder',
    type: 'text',
    tab: 'content',
    required: false,
    default: 'Phone',
  },
  {
    name: 'areaOfInterestPlaceholder',
    label: 'Area of Interest Placeholder',
    type: 'text',
    tab: 'content',
    required: false,
    default: 'Area of Interest',
  },
  {
    name: 'areaOfInterestOptions',
    label: 'Area of Interest Options',
    type: 'textarea',
    tab: 'content',
    required: false,
    helpText: 'Enter one option per line for the dropdown',
  },
  {
    name: 'consentCheckboxLabel',
    label: 'Consent Checkbox Label',
    type: 'text',
    tab: 'content',
    required: false,
    helpText: 'Label for the consent checkbox',
  },
  {
    name: 'submitButtonText',
    label: 'Submit Button Text',
    type: 'text',
    tab: 'content',
    required: false,
    default: 'Submit',
  },
  {
    name: 'legalDisclaimer',
    label: 'Legal Disclaimer',
    type: 'textarea',
    tab: 'content',
    required: false,
    helpText: 'Legal text displayed below the form',
  },
  {
    name: 'termsLinkText',
    label: 'Terms Link Text',
    type: 'text',
    tab: 'content',
    required: false,
    default: 'Terms of Service',
  },
  {
    name: 'termsLinkUrl',
    label: 'Terms Link URL',
    type: 'url',
    tab: 'content',
    required: false,
  },
  {
    name: 'privacyLinkText',
    label: 'Privacy Link Text',
    type: 'text',
    tab: 'content',
    required: false,
    default: 'Privacy Policy',
  },
  {
    name: 'privacyLinkUrl',
    label: 'Privacy Link URL',
    type: 'url',
    tab: 'content',
    required: false,
  },
  {
    name: 'formAction',
    label: 'Form Action URL',
    type: 'url',
    tab: 'content',
    required: true,
    helpText: 'URL where the form will be submitted',
  },
]

// Hero with form design fields
const heroWithFormDesignFields: FieldDefinition[] = [
  {
    name: 'overlayOpacity',
    label: 'Overlay Opacity',
    type: 'select',
    tab: 'design',
    required: false,
    default: '40',
    helpText: 'Dark overlay opacity for text readability (0-80)',
    options: [
      { label: 'None (0%)', value: '0' },
      { label: 'Light (20%)', value: '20' },
      { label: 'Medium (40%)', value: '40' },
      { label: 'Dark (60%)', value: '60' },
      { label: 'Very Dark (80%)', value: '80' },
    ],
  },
]

/**
 * Complete field definitions organized by tab
 */
export const fieldDefinitions: FieldDefinition[] = [
  // Content tab: hero with form fields
  ...heroWithFormContentFields,

  // Design tab: base fields + hero with form specific
  ...baseDesignFields,
  ...heroWithFormDesignFields,

  // Advanced tab: base fields only
  ...baseAdvancedFields,
]

// Alias for compatibility
export const fields = fieldDefinitions
