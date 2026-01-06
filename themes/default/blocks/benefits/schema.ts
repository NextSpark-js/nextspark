import { z } from 'zod'
import { baseBlockSchema } from '@nextsparkjs/core/types/blocks'

const benefitItemSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  borderColor: z.string().optional().default('#3b82f6'),
})

export const benefitsSchema = baseBlockSchema.extend({
  // Content
  sectionTitle: z.string().optional(),
  sectionSubtitle: z.string().optional(),

  // Benefits array
  benefits: z.array(benefitItemSchema).min(1).max(6).default([
    { title: 'Benefit 1', description: 'Description for benefit 1', borderColor: '#3b82f6' },
    { title: 'Benefit 2', description: 'Description for benefit 2', borderColor: '#10b981' },
    { title: 'Benefit 3', description: 'Description for benefit 3', borderColor: '#f59e0b' },
  ]),

  // Design options
  showColoredBorders: z.boolean().default(false),
  columns: z.enum(['2', '3', '4']).default('3'),

  // Demo fields for testing new field types
  publishDate: z.string().optional(),
  eventTime: z.string().optional(),
  lastUpdated: z.string().optional(),
  cardStyle: z.enum(['minimal', 'bordered', 'elevated']).default('bordered'),
})

export type BenefitsProps = z.infer<typeof benefitsSchema>
