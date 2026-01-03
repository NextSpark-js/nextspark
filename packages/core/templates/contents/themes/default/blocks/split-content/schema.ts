import { z } from 'zod'
import {
  baseBlockSchema,
  ctaSchema,
  type BaseBlockProps,
} from '@nextsparkjs/core/types/blocks'

/**
 * Bullet Point Schema
 * Individual bullet point item
 */
const bulletPointSchema = z.object({
  text: z.string().min(1, 'Bullet point text is required').max(200),
})

export type BulletPoint = z.infer<typeof bulletPointSchema>

/**
 * CTA with Variant Schema
 * Extends base CTA with variant option
 */
const ctaWithVariantSchema = ctaSchema.extend({
  variant: z.enum(['default', 'outline', 'secondary']).default('default'),
})

export type CTAWithVariant = z.infer<typeof ctaWithVariantSchema>

/**
 * Split Content Block Schema
 *
 * Extends base schema with:
 * - subtitle: Optional eyebrow/label above title
 * - image: Featured image URL (required)
 * - imageAlt: Image alt text for accessibility
 * - cta: CTA button with variant option
 * - bulletPoints: Optional list of bullet points
 * - imagePosition: Image position (left/right)
 * - imageStyle: Image corner style (square/rounded/circle)
 * - verticalAlign: Vertical content alignment
 *
 * Note: Uses base schema title, content, backgroundColor, className, id
 */
export const splitContentSpecificSchema = z.object({
  // Content fields
  subtitle: z.string().optional(),
  image: z.string().url('Must be a valid image URL').min(1, 'Image is required'),
  imageAlt: z.string().optional(),
  cta: ctaWithVariantSchema.optional(),
  bulletPoints: z.array(bulletPointSchema).max(10, 'Maximum 10 bullet points allowed').optional(),

  // Design fields
  imagePosition: z.enum(['left', 'right']).default('left'),
  imageStyle: z.enum(['square', 'rounded', 'circle']).default('rounded'),
  verticalAlign: z.enum(['top', 'center', 'bottom']).default('center'),
})

/**
 * Complete Split Content Block Schema
 */
export const schema = baseBlockSchema
  .omit({ cta: true }) // Remove base cta
  .merge(splitContentSpecificSchema)

export type SplitContentBlockProps = z.infer<typeof schema>

// Also export for type-only imports
export type { BaseBlockProps }
