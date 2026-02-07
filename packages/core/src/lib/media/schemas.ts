import { z } from 'zod'

export const createMediaSchema = z.object({
  url: z.string().url('Invalid URL format'),
  filename: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  title: z.string().max(255).nullable().optional(),
  alt: z.string().max(500).nullable().optional(),
  caption: z.string().max(1000).nullable().optional(),
})

export const updateMediaSchema = z.object({
  title: z.string().max(255).nullable().optional(),
  alt: z.string().max(500).nullable().optional(),
  caption: z.string().max(1000).nullable().optional(),
})

export const mediaListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
  orderBy: z.enum(['createdAt', 'filename', 'fileSize']).optional().default('createdAt'),
  orderDir: z.enum(['asc', 'desc']).optional().default('desc'),
  type: z.enum(['image', 'video', 'all']).optional().default('all'),
  search: z.string().optional(),
  tagIds: z.string().transform(s => s.split(',')).optional(),
  tagSlugs: z.string().transform(s => s.split(',')).optional(),
})
