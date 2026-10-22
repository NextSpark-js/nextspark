import type { UploadedImage } from '../../ui/image-upload'

// The image field stores a URL string; data saved as an upload object (or a list of them) still shows
export function toUploadedImages(stored: unknown): UploadedImage[] {
  if (Array.isArray(stored)) return stored as UploadedImage[]
  if (stored && typeof stored === 'object') return [stored as UploadedImage]
  const url = stored ? String(stored) : ''
  return url ? [{ id: url, name: '', size: 0, url }] : []
}
