import { MEDIA_CONFIG } from '../config/config-sync'

/** Types the server accepts (theme-overridable through app.config `media.allowedMimeTypes`). */
export function allowedMimeTypes(): string[] {
  return MEDIA_CONFIG?.allowedMimeTypes ?? [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm',
    'application/pdf', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg',
  ]
}

/** Maximum size in MB for a type: maxSizeImageMB / maxSizeVideoMB when set, else maxSizeMB (10). */
export function maxSizeMBFor(mimeType: string): number {
  if (mimeType.startsWith('image/') && MEDIA_CONFIG?.maxSizeImageMB != null) return MEDIA_CONFIG.maxSizeImageMB
  if (mimeType.startsWith('video/') && MEDIA_CONFIG?.maxSizeVideoMB != null) return MEDIA_CONFIG.maxSizeVideoMB
  return MEDIA_CONFIG?.maxSizeMB ?? 10
}
