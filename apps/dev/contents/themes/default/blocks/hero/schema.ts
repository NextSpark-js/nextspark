import { z } from 'zod'
import {
  baseBlockSchema,
  type BaseBlockProps,
} from '@nextsparkjs/core/types/blocks'

/**
 * Hero Block Schema
 *
 * Extends base schema with hero-specific fields:
 * - backgroundImage: Optional hero background
 * - textColor: Light/dark for contrast
 *
 * Note: Uses base schema title, content, cta, backgroundColor, className, id
 * The `content` field serves as the hero subtitle/description
 */
export const heroSpecificSchema = z.object({
  // Hero-specific design fields
  backgroundImage: z.string().url('Must be a valid URL').optional(),
  textColor: z.enum(['light', 'dark']).default('light'),
})

/**
 * Complete Hero Block Schema
 * Combines base fields + hero-specific fields
 */
export const schema = baseBlockSchema.merge(heroSpecificSchema)

export type HeroBlockProps = z.infer<typeof schema>

// Also export for type-only imports
export type { BaseBlockProps }
