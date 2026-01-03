import { z } from 'zod'
import { baseBlockSchema, ctaSchema } from '@nextsparkjs/core/types/blocks'

/**
 * Primary CTA Schema for Jumbotron
 * Extends standard CTA with variant options
 */
const primaryCtaSchema = ctaSchema.extend({
  variant: z.enum(['default', 'outline', 'secondary']).default('default'),
})

/**
 * Secondary CTA Schema for Jumbotron
 * Uses same structure as primary CTA
 */
const secondaryCtaSchema = ctaSchema.extend({
  variant: z.enum(['default', 'outline', 'secondary']).default('outline'),
})

export type PrimaryCta = z.infer<typeof primaryCtaSchema>
export type SecondaryCta = z.infer<typeof secondaryCtaSchema>

/**
 * Jumbotron Block Schema
 *
 * Extends base schema with:
 * - subtitle: Supporting text/description (separate from content)
 * - primaryCta: Primary CTA button with variant
 * - secondaryCta: Optional secondary CTA button with variant
 * - fullscreen: Toggle for 100vh height
 * - backgroundImage: Optional background image
 * - textColor: Light/dark for contrast
 * - textAlign: Content alignment (center, left, right)
 *
 * Note: Uses base schema title, backgroundColor, className, id
 */
export const jumbotronSpecificSchema = z.object({
  // Content fields
  subtitle: z.string().optional(),
  primaryCta: primaryCtaSchema.optional(),
  secondaryCta: secondaryCtaSchema.optional(),

  // Design fields
  fullscreen: z.boolean().default(false),
  backgroundImage: z.string().url('Must be a valid URL').optional(),
  textColor: z.enum(['light', 'dark']).default('light'),
  textAlign: z.enum(['center', 'left', 'right']).default('center'),
})

/**
 * Complete Jumbotron Block Schema
 */
export const schema = baseBlockSchema.merge(jumbotronSpecificSchema)

export type JumbotronBlockProps = z.infer<typeof schema>
