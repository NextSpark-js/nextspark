import { z } from 'zod'
import { baseBlockSchema } from '@nextsparkjs/core/types/blocks'

/**
 * Logo Item Schema
 * Individual logo in the cloud
 */
const logoItemSchema = z.object({
  image: z.string().url('Must be a valid URL'),
  alt: z.string().min(1, 'Alt text is required for accessibility'),
  url: z.string().url('Must be a valid URL').optional(),
})

export type LogoItem = z.infer<typeof logoItemSchema>

/**
 * Logo Cloud Block Schema
 *
 * Extends base schema with:
 * - logos: Array of logo items (image, alt, optional url)
 * - layout: Layout style (grid, row, row-scroll)
 * - columns: Grid columns (3, 4, 5, 6)
 * - grayscale: Show logos in grayscale with hover effect
 * - size: Logo size (sm, md, lg)
 *
 * Note: Uses base schema title, content, cta, backgroundColor, className, id
 */
export const logoCloudSpecificSchema = z.object({
  // Content: array of logo items
  logos: z.array(logoItemSchema)
    .min(1, 'At least one logo is required')
    .max(20, 'Maximum 20 logos allowed'),

  // Design: layout and styling
  layout: z.enum(['grid', 'row', 'row-scroll']).default('grid'),
  columns: z.enum(['3', '4', '5', '6']).default('5'),
  grayscale: z.boolean().default(true),
  size: z.enum(['sm', 'md', 'lg']).default('md'),
})

/**
 * Complete Logo Cloud Block Schema
 */
export const schema = baseBlockSchema.merge(logoCloudSpecificSchema)

export type LogoCloudBlockProps = z.infer<typeof schema>
