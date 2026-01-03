import { z } from 'zod'
import { baseBlockSchema } from '@/core/types/blocks'

/**
 * Text Content Block Schema
 *
 * Extends base schema with:
 * - content: Rich text/HTML content (overrides base content with required)
 * - maxWidth: Content width constraint
 * - alignment: Text alignment
 *
 * Note: Uses base schema title, cta, backgroundColor, className, id
 * The `content` field is overridden to be required and serves as rich-text body
 */
export const textContentSpecificSchema = z.object({
  // Content: rich text body (overrides base optional content)
  content: z.string().min(1, 'Content is required'),

  // Design: layout options
  maxWidth: z.enum(['sm', 'md', 'lg', 'xl', 'full']).default('lg'),
  alignment: z.enum(['left', 'center', 'right']).default('left'),
})

/**
 * Complete Text Content Block Schema
 * Note: textContentSpecificSchema.content overrides baseBlockSchema.content
 */
export const schema = baseBlockSchema.merge(textContentSpecificSchema)

export type TextContentBlockProps = z.infer<typeof schema>
