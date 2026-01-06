import { z } from 'zod'
import { baseBlockSchema } from '@nextsparkjs/core/types/blocks'

/**
 * FAQ Item Schema
 * Individual question-answer pair in the accordion
 */
const faqItemSchema = z.object({
  question: z.string().min(1, 'Question is required').max(200),
  answer: z.string().min(1, 'Answer is required').max(1000),
})

export type FaqItem = z.infer<typeof faqItemSchema>

/**
 * FAQ Accordion Block Schema
 *
 * Extends base schema with:
 * - subtitle: Section description
 * - items: Array of FAQ items (question, answer)
 * - allowMultiple: Allow multiple items open at once
 * - defaultOpenFirst: First item open by default
 * - variant: Visual style variant
 *
 * Note: Uses base schema title, backgroundColor, className, id
 */
export const faqAccordionSpecificSchema = z.object({
  // Content: subtitle and FAQ items
  subtitle: z.string().optional(),
  items: z.array(faqItemSchema)
    .min(1, 'At least one FAQ item is required')
    .max(20, 'Maximum 20 FAQ items allowed'),

  // Design: accordion behavior and styling
  allowMultiple: z.boolean().default(false),
  defaultOpenFirst: z.boolean().default(true),
  variant: z.enum(['default', 'bordered', 'separated']).default('default'),
})

/**
 * Complete FAQ Accordion Block Schema
 */
export const schema = baseBlockSchema.merge(faqAccordionSpecificSchema)

export type FaqAccordionBlockProps = z.infer<typeof schema>
