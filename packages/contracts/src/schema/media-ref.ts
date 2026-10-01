/**
 * Media Reference Schema
 *
 * Blocks and media-library fields store media references in two formats:
 * - Legacy: plain URL string (backward compatible)
 * - New: object with mediaId + url (enables future URL re-resolution)
 *
 * PORTABLE: imports zod only.
 */

import * as z from 'zod'

export const mediaRefObjectSchema = z.object({
  mediaId: z.string(),
  url: z.string(),
})

export const mediaRefSchema = z.union([
  z.string(),
  mediaRefObjectSchema,
])

export type MediaRef = z.infer<typeof mediaRefSchema>
export type MediaRefObject = z.infer<typeof mediaRefObjectSchema>
