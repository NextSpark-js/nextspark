import { z } from 'zod'
import { baseBlockSchema } from '@nextsparkjs/core/types/blocks'

/**
 * Stat Item Schema
 * Individual statistic with value, label, and optional prefix/suffix
 */
const statItemSchema = z.object({
  value: z.string().min(1, 'Value is required'),
  label: z.string().min(1, 'Label is required').max(100),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
})

export type StatItem = z.infer<typeof statItemSchema>

/**
 * Stats Counter Block Schema
 *
 * Extends base schema with:
 * - stats: Array of statistics (value, label, prefix, suffix)
 * - columns: Grid layout option (2, 3, 4 columns)
 * - variant: Visual style (default, cards, minimal)
 * - size: Number size (sm, md, lg)
 *
 * Note: Uses base schema title, content, cta, backgroundColor, className, id
 * The `title` field serves as optional section title
 * The `content` field serves as optional section description/subtitle
 */
export const statsCounterSpecificSchema = z.object({
  // Content: array of stat items
  stats: z.array(statItemSchema)
    .min(1, 'At least one statistic is required')
    .max(8, 'Maximum 8 statistics allowed'),

  // Design: visual appearance
  columns: z.enum(['2', '3', '4']).default('4'),
  variant: z.enum(['default', 'cards', 'minimal']).default('default'),
  size: z.enum(['sm', 'md', 'lg']).default('md'),
})

/**
 * Complete Stats Counter Block Schema
 */
export const schema = baseBlockSchema.merge(statsCounterSpecificSchema)

export type StatsCounterBlockProps = z.infer<typeof schema>
