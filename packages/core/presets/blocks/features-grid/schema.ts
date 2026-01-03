import { z } from 'zod'
import { baseBlockSchema } from '@/core/types/blocks'

/**
 * Feature Item Schema
 * Individual feature in the grid
 */
const featureItemSchema = z.object({
  icon: z.string().min(1, 'Icon name is required'),
  title: z.string().min(1, 'Feature title is required').max(100),
  description: z.string().min(1, 'Description is required').max(300),
})

export type FeatureItem = z.infer<typeof featureItemSchema>

/**
 * Features Grid Block Schema
 *
 * Extends base schema with:
 * - items: Array of feature items (icon, title, description)
 * - columns: Grid layout option (2, 3, 4 columns)
 *
 * Note: Uses base schema title, description, cta, backgroundColor, className, id
 */
export const featuresGridSpecificSchema = z.object({
  // Content: array of feature items
  items: z.array(featureItemSchema)
    .min(1, 'At least one feature is required')
    .max(12, 'Maximum 12 features allowed'),

  // Design: column layout
  columns: z.enum(['2', '3', '4']).default('3'),
})

/**
 * Complete Features Grid Block Schema
 */
export const schema = baseBlockSchema.merge(featuresGridSpecificSchema)

export type FeaturesGridBlockProps = z.infer<typeof schema>
