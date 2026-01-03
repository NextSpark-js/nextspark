import { z } from 'zod'
import { baseBlockSchema } from '@nextsparkjs/core/types/blocks'

/**
 * Post Content Block Schema
 *
 * Extends base schema with editorial-focused fields:
 * - content: Main article content (overrides base content with required)
 * - showDropCap: Display decorative drop cap on first letter
 * - dropCapStyle: Style variant for the drop cap
 * - maxWidth: Reading width control for optimal typography
 * - fontSize: Base font size for content
 * - lineHeight: Line spacing for readability
 * - paragraphSpacing: Vertical spacing between paragraphs
 * - showDividers: Show subtle section dividers
 * - dividerStyle: Visual style for dividers
 *
 * Note: Uses base schema title, cta, backgroundColor, className, id
 * The `content` field is overridden to be required and serves as the main article body
 */
export const postContentSpecificSchema = z.object({
  // Content: rich text body (overrides base optional content)
  content: z.string().min(1, 'Content is required'),

  // Design: drop cap styling
  showDropCap: z.boolean().default(false),
  dropCapStyle: z.enum(['serif', 'sans-serif', 'decorative']).default('serif'),

  // Design: layout and typography
  maxWidth: z.enum(['narrow', 'medium', 'wide']).default('narrow'),
  fontSize: z.enum(['small', 'medium', 'large']).default('medium'),
  lineHeight: z.enum(['compact', 'normal', 'relaxed']).default('relaxed'),
  paragraphSpacing: z.enum(['tight', 'normal', 'loose']).default('normal'),

  // Design: section dividers
  showDividers: z.boolean().default(false),
  dividerStyle: z.enum(['line', 'dots', 'asterisks']).default('line'),
})

/**
 * Complete Post Content Block Schema
 * Note: postContentSpecificSchema.content overrides baseBlockSchema.content
 */
export const schema = baseBlockSchema.merge(postContentSpecificSchema)

export type PostContentBlockProps = z.infer<typeof schema>
