/**
 * Social Media Publisher - Validation Schemas
 *
 * Zod schemas for request validation
 */

import { z } from 'zod'

// ============================================
// PUBLISH REQUEST SCHEMAS
// ============================================

export const PublishPhotoSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  imageUrl: z.string().url('Invalid image URL').nullish(), // ✅ Accepts null/undefined - Facebook allows text-only
  imageUrls: z.array(z.string().url('Invalid image URL')).optional(), // For carousels
  caption: z.string().max(2200).optional(),
  platform: z.enum(['instagram_business', 'facebook_page']),
}).refine(data => {
  // Instagram requires at least one image
  if (data.platform === 'instagram_business') {
    return (data.imageUrl || (data.imageUrls && data.imageUrls.length > 0))
  }
  return true
}, { message: 'Instagram requires at least one image' }).refine(data => {
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
  platform: z.enum(['instagram_business', 'facebook_page']),
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
 * Validate caption length for platform
 */
export function validateCaption(
  caption: string,
  platform: 'instagram_business' | 'facebook_page'
): {
  valid: boolean
  error?: string
} {
  const maxLengths = {
    instagram_business: 2200,
    facebook_page: 63206,
  }

  const maxLength = maxLengths[platform]

  if (caption.length > maxLength) {
    return {
      valid: false,
      error: `Caption exceeds maximum length of ${maxLength} characters for ${platform}`,
    }
  }

  return { valid: true }
}

/**
 * Check if a platform requires an image to publish
 * Instagram: Always requires image/video
 * Facebook: Allows text-only posts
 */
export function platformRequiresImage(platform: string): boolean {
  const platformsRequiringImage = [
    'instagram_business',
    'tiktok',
    'pinterest',
  ]
  return platformsRequiringImage.includes(platform)
}
