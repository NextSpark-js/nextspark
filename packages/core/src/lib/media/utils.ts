/**
 * Media Utilities
 * Image dimension extraction and MIME type helpers.
 */

export interface ImageDimensions {
  width: number
  height: number
}

/**
 * Extract image dimensions from a Buffer using sharp.
 * Returns null for non-image files or if sharp is not available.
 *
 * Sharp is dynamically imported because it is a heavy native module (~2MB)
 * that should only be loaded when actually processing images.
 * This is an ALLOWED exception per the dynamic import policy (heavy user-triggered library).
 */
export async function extractImageDimensions(
  buffer: Buffer,
  mimeType: string
): Promise<ImageDimensions | null> {
  if (!mimeType.startsWith('image/')) {
    return null
  }

  try {
    const sharpModule = await import('sharp')
    const sharp = 'default' in sharpModule ? sharpModule.default : sharpModule
    const metadata = await sharp(buffer).metadata()

    if (metadata.width && metadata.height) {
      return {
        width: metadata.width,
        height: metadata.height,
      }
    }
    return null
  } catch {
    console.warn('[Media] Failed to extract image dimensions')
    return null
  }
}

/**
 * Determine media type category from MIME type
 */
export function getMediaTypeCategory(mimeType: string): 'image' | 'video' | 'other' {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  return 'other'
}

/**
 * Sanitize filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 255)
}
