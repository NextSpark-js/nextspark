import { z } from 'zod'
import { baseBlockSchema } from '@/core/types/blocks'

/**
 * Testimonial Item Schema
 * Individual testimonial entry
 */
const testimonialItemSchema = z.object({
  quote: z.string().min(1, 'Quote is required').max(500),
  author: z.string().min(1, 'Author name is required').max(100),
  role: z.string().max(100).optional(),
  avatar: z.string().url('Must be a valid URL').optional(),
})

export type TestimonialItem = z.infer<typeof testimonialItemSchema>

/**
 * Testimonials Block Schema
 *
 * Extends base schema with:
 * - items: Array of testimonial items
 * - columns: Grid layout option (2, 3 columns)
 *
 * Note: Uses base schema title, description, cta, backgroundColor, className, id
 */
export const testimonialsSpecificSchema = z.object({
  // Content: array of testimonials
  items: z.array(testimonialItemSchema)
    .min(1, 'At least one testimonial is required')
    .max(6, 'Maximum 6 testimonials allowed'),

  // Design: column layout
  columns: z.enum(['2', '3']).default('3'),
})

/**
 * Complete Testimonials Block Schema
 */
export const schema = baseBlockSchema.merge(testimonialsSpecificSchema)

export type TestimonialsBlockProps = z.infer<typeof schema>
