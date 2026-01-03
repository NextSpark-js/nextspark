import { z } from 'zod'
import { baseBlockSchema } from '@nextsparkjs/core/types/blocks'

/**
 * Pricing Plan Item Schema
 * Individual pricing plan in the table
 */
const planItemSchema = z.object({
  name: z.string().min(1, 'Plan name is required').max(50),
  price: z.string().min(1, 'Price is required').max(50),
  period: z.string().max(50).optional(),
  description: z.string().max(200).optional(),
  features: z.string().optional(), // Newline-separated features
  ctaText: z.string().max(50).optional(),
  ctaUrl: z.string().optional(),
  isPopular: z.boolean().default(false),
  isDisabled: z.boolean().default(false),
})

export type PlanItem = z.infer<typeof planItemSchema>

/**
 * Pricing Table Block Schema
 *
 * Extends base schema with:
 * - title: Section title (from base)
 * - subtitle: Section description (from base content field)
 * - plans: Array of pricing plans
 * - columns: Grid layout option (2, 3, 4 columns)
 * - highlightPopular: Whether to highlight popular plan
 *
 * Note: Uses base schema title, content, backgroundColor, className, id
 */
export const pricingTableSpecificSchema = z.object({
  // Content: array of pricing plans
  plans: z.array(planItemSchema)
    .min(1, 'At least one plan is required')
    .max(4, 'Maximum 4 plans allowed'),

  // Design: column layout and highlighting
  columns: z.enum(['2', '3', '4']).default('3'),
  highlightPopular: z.boolean().default(true),
})

/**
 * Complete Pricing Table Block Schema
 */
export const schema = baseBlockSchema.merge(pricingTableSpecificSchema)

export type PricingTableBlockProps = z.infer<typeof schema>
