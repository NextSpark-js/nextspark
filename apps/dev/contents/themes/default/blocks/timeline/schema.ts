import { z } from 'zod'
import { baseBlockSchema } from '@nextsparkjs/core/types/blocks'

/**
 * Timeline Item Schema
 * Individual event/step in the timeline
 */
const timelineItemSchema = z.object({
  date: z.string().min(1, 'Date or step is required'),
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().optional().default(''),
  icon: z.string().optional().default(''),
})

export type TimelineItem = z.infer<typeof timelineItemSchema>

/**
 * Timeline Block Schema
 *
 * Extends base schema with:
 * - subtitle: Section description (in addition to title)
 * - items: Array of timeline items (date, title, description, icon)
 * - layout: Vertical or horizontal direction
 * - alternating: Alternate items left/right (vertical only)
 * - showConnector: Show connecting line between items
 * - variant: Visual style (default, minimal, cards)
 *
 * Note: Uses base schema title, backgroundColor, className, id
 */
export const timelineSpecificSchema = z.object({
  // Content fields
  subtitle: z.string().optional().default(''),
  items: z.array(timelineItemSchema)
    .min(1, 'At least one timeline item is required')
    .max(20, 'Maximum 20 timeline items allowed'),

  // Design fields
  layout: z.enum(['vertical', 'horizontal']).default('vertical'),
  alternating: z.boolean().default(true),
  showConnector: z.boolean().default(true),
  variant: z.enum(['default', 'minimal', 'cards']).default('default'),
})

/**
 * Complete Timeline Block Schema
 */
export const schema = baseBlockSchema.merge(timelineSpecificSchema)

export type TimelineBlockProps = z.infer<typeof schema>
