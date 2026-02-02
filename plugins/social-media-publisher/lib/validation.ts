/**
 * Social Media Publisher - Validation Schemas
 *
 * Zod schemas for request validation.
 * Uses platform constants from social.types.ts for consistency.
 */

import { z } from 'zod'
import {
  IMPLEMENTED_PLATFORMS,
  IMAGE_REQUIRED_PLATFORMS,
  type ImplementedPlatform
} from '../types/social.types'

// ============================================
// PUBLISH REQUEST SCHEMAS
// ============================================

/**
 * Schema for publishing photos/carousels to social media.
 * Uses IMPLEMENTED_PLATFORMS for validation - only platforms with working providers.
 */
export const PublishPhotoSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  entityId: z.string().uuid('Invalid entity ID').optional(), // Parent entity for adapter lookup
  imageUrl: z.string().url('Invalid image URL').nullish(), // ✅ Accepts null/undefined - Facebook allows text-only
  imageUrls: z.array(z.string().url('Invalid image URL')).optional(), // For carousels
  caption: z.string().max(2200).optional(),
  platform: z.enum(IMPLEMENTED_PLATFORMS),
}).refine(data => {
  // Platforms in IMAGE_REQUIRED_PLATFORMS require at least one image
  if (IMAGE_REQUIRED_PLATFORMS.includes(data.platform)) {
    return (data.imageUrl || (data.imageUrls && data.imageUrls.length > 0))
  }
  return true
}, { message: 'This platform requires at least one image' }).refine(data => {
  // Instagram allows maximum 10 images per carousel
  if (data.platform === 'instagram_business' && data.imageUrls && data.imageUrls.length > 10) {
    return false
  }
  return true
}, { message: 'Instagram allows maximum 10 images per carousel' })

export const PublishTextSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  message: z.string().min(1, 'Message is required').max(5000),
  platform: z.literal('facebook_page'), // Only Facebook supports text-only posts
})

export const PublishLinkSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  message: z.string().max(5000).optional(),
  linkUrl: z.string().url('Invalid link URL'),
  platform: z.literal('facebook_page'),
})

// ============================================
// CONNECT ACCOUNT SCHEMAS
// ============================================

export const ConnectAccountSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'State parameter is required'),
  platform: z.enum(IMPLEMENTED_PLATFORMS),
})

// ============================================
// DISCONNECT ACCOUNT SCHEMAS
// ============================================

export const DisconnectAccountSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
})

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate image URL requirements
 */
export function validateImageUrl(url: string): {
  valid: boolean
  error?: string
} {
  try {
    const parsed = new URL(url)

    // Must be HTTPS
    if (parsed.protocol !== 'https:') {
      return {
        valid: false,
        error: 'Image URL must use HTTPS protocol',
      }
    }

    // Must not be localhost
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return {
        valid: false,
        error: 'Image URL cannot be localhost',
      }
    }

    // Check file extension
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    const hasValidExtension = validExtensions.some(ext =>
      parsed.pathname.toLowerCase().endsWith(ext)
    )

    if (!hasValidExtension) {
      return {
        valid: false,
        error: `Image must be one of: ${validExtensions.join(', ')}`,
      }
    }

    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid URL format',
    }
  }
}

/**
 * Maximum caption lengths per platform.
 * Add new platforms here as they are implemented.
 */
const CAPTION_MAX_LENGTHS: Record<ImplementedPlatform, number> = {
  instagram_business: 2200,
  facebook_page: 63206,
}

/**
 * Validate caption length for platform
 */
export function validateCaption(
  caption: string,
  platform: ImplementedPlatform
): {
  valid: boolean
  error?: string
} {
  const maxLength = CAPTION_MAX_LENGTHS[platform]

  if (!maxLength) {
    // Unknown platform, allow any length
    return { valid: true }
  }

  if (caption.length > maxLength) {
    return {
      valid: false,
      error: `Caption exceeds maximum length of ${maxLength} characters for ${platform}`,
    }
  }

  return { valid: true }
}

/**
 * Check if a platform requires an image to publish.
 * Uses IMAGE_REQUIRED_PLATFORMS constant from social.types.ts.
 *
 * Platforms that require images:
 * - Instagram: Always requires image/video
 * - TikTok: Video platform
 * - Pinterest: Visual platform
 *
 * Platforms that allow text-only:
 * - Facebook: Supports text posts
 * - Twitter: Supports text tweets
 * - LinkedIn: Supports text posts
 */
export function platformRequiresImage(platform: string): boolean {
  return IMAGE_REQUIRED_PLATFORMS.includes(platform as ImplementedPlatform)
}
