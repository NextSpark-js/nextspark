import { z } from 'zod'
import { baseBlockSchema, ctaSchema } from '@nextsparkjs/core/types/blocks'

/**
 * Secondary Button Schema (CTA-specific)
 * Uses same structure as CTA but with outline variant default
 */
const secondaryButtonSchema = ctaSchema.extend({
  variant: z.enum(['default', 'outline', 'ghost']).default('outline'),
})

export type SecondaryButton = z.infer<typeof secondaryButtonSchema>

/**
 * CTA Section Block Schema
 *
 * Extends base schema with:
 * - secondaryButton: Optional secondary CTA button
 *
 * Note: Uses base schema title, description, cta (as primary), backgroundColor, className, id
 */
export const ctaSectionSpecificSchema = z.object({
  // Content: secondary button option
  secondaryButton: secondaryButtonSchema.optional(),
})

/**
 * Complete CTA Section Block Schema
 */
export const schema = baseBlockSchema.merge(ctaSectionSpecificSchema)

export type CTASectionBlockProps = z.infer<typeof schema>
