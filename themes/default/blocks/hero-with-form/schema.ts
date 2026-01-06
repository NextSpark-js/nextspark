import { z } from 'zod'
import {
  baseBlockSchema,
  type BaseBlockProps,
} from '@nextsparkjs/core/types/blocks'

/**
 * Hero With Form Block Schema
 *
 * Extends base schema with hero-with-form-specific fields:
 * - backgroundImage: Required hero background
 * - overlayOpacity: Dark overlay for text readability
 * - Form fields for lead capture
 *
 * Note: Uses base schema backgroundColor, className, id
 * The base `title` and `content` serve as main headline and subtitle
 */
export const heroWithFormSpecificSchema = z.object({
  // Content fields
  subtitle: z.string().optional(),
  backgroundImage: z.string().url('Must be a valid URL'),

  // Form content
  formTitle: z.string().default('Get Started'),
  formSubtitle: z.string().optional(),
  firstNamePlaceholder: z.string().default('First Name'),
  lastNamePlaceholder: z.string().default('Last Name'),
  emailPlaceholder: z.string().default('Email'),
  phonePlaceholder: z.string().default('Phone'),
  areaOfInterestPlaceholder: z.string().default('Area of Interest'),
  areaOfInterestOptions: z.string().optional(),
  consentCheckboxLabel: z.string().optional(),
  submitButtonText: z.string().default('Submit'),
  legalDisclaimer: z.string().optional(),
  termsLinkText: z.string().default('Terms of Service'),
  termsLinkUrl: z.string().url().optional(),
  privacyLinkText: z.string().default('Privacy Policy'),
  privacyLinkUrl: z.string().url().optional(),
  formAction: z.string().url('Must be a valid URL'),

  // Design fields
  overlayOpacity: z.enum(['0', '20', '40', '60', '80']).default('40'),
})

/**
 * Complete Hero With Form Block Schema
 * Combines base fields + hero-with-form-specific fields
 */
export const schema = baseBlockSchema.merge(heroWithFormSpecificSchema)

export type HeroWithFormBlockProps = z.infer<typeof schema>

// Also export for type-only imports
export type { BaseBlockProps }
