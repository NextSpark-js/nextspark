import * as z from 'zod'

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

/** Most tag ids, duplicate-check entries and files one media request carries. */
export const MAX_MEDIA_BATCH = 100

/** Longest tag name, in characters. */
export const MAX_TAG_NAME_LENGTH = 100

const commaList = z.string().transform(s => (s ? s.split(',').filter(Boolean) : [])).pipe(z.array(z.string()).max(MAX_MEDIA_BATCH))

export const createMediaTagSchema = z.object({
  name: z.string().trim().min(1).max(MAX_TAG_NAME_LENGTH),
})

export const checkDuplicatesSchema = z.object({
  files: z.array(z.object({
    filename: z.string().min(1).max(255),
    fileSize: z.number().int().min(0),
  })).min(1).max(MAX_MEDIA_BATCH),
})

export const mediaListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
  orderBy: z.enum(['createdAt', 'filename', 'fileSize']).optional().default('createdAt'),
  orderDir: z.enum(['asc', 'desc']).optional().default('desc'),
  type: z.enum(['image', 'video', 'all']).optional().default('all'),
  search: z.string().optional(),
  tagIds: commaList.optional(),
  tagSlugs: commaList.optional(),
})

/** POST /api/v1/media/upload/presign: what the client is about to upload directly to storage */
export const presignUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  size: z.number().int().positive(),
})

/** POST /api/v1/media/upload/confirm: the token the presign returned */
export const confirmUploadSchema = z.object({
  token: z.string().min(1).max(4096),
})
