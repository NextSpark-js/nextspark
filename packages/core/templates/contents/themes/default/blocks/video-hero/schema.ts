import { z } from 'zod'
import {
  baseBlockSchema,
  type BaseBlockProps,
} from '@nextsparkjs/core/types/blocks'

/**
 * Video Hero Block Schema
 *
 * Extends base schema with video-specific fields:
 * - videoUrl: YouTube or Vimeo URL (required)
 * - videoThumbnail: Custom thumbnail image
 * - layout: How video is displayed (inline, background, side-by-side)
 * - autoplay: Auto-play video when loaded (muted)
 * - overlayOpacity: Opacity for background layout overlay
 *
 * Note: Uses base schema title, content (as subtitle), cta, backgroundColor, className, id
 */
export const videoHeroSpecificSchema = z.object({
  // Content fields
  videoUrl: z.string().url('Must be a valid YouTube or Vimeo URL'),
  videoThumbnail: z.string().url('Must be a valid URL').optional(),

  // Design fields
  layout: z.enum(['inline', 'background', 'side-by-side']).default('inline'),
  autoplay: z.boolean().default(false),
  overlayOpacity: z.enum(['0', '20', '40', '60']).default('40'),
})

/**
 * Complete Video Hero Block Schema
 * Combines base fields + video-hero-specific fields
 */
export const schema = baseBlockSchema.merge(videoHeroSpecificSchema)

export type VideoHeroBlockProps = z.infer<typeof schema>

// Also export for type-only imports
export type { BaseBlockProps }
