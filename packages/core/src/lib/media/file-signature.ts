/**
 * Upload type checks: the stored extension comes from the allow-listed MIME
 * type, and the file's leading bytes must match that type.
 */

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/mpeg': 'mpg',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'application/pdf': 'pdf',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
}

/** Extension for an allow-listed MIME type; `bin` for a type this table does not know (never served as a page). */
export function extensionForMime(mimeType: string): string {
  return EXTENSION_BY_MIME[mimeType] ?? 'bin'
}

// Raster images and video: rendered by the browser, never run. Anything else (PDF and audio included) is stored and served as a download.
const INLINE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm'])

/** Whether a stored file of this type may be shown inline; any other type gets `Content-Disposition: attachment`. */
export function isInlineType(mimeType: string): boolean {
  return INLINE_TYPES.has(mimeType)
}

/** Type to serve a stored file with, from the extension the server gave it; undefined for `bin` or an unknown one. */
export function mimeForExtension(extension: string): string | undefined {
  return Object.keys(EXTENSION_BY_MIME).find((mimeType) => EXTENSION_BY_MIME[mimeType] === extension)
}

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((value, index) => bytes[offset + index] === value)

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0))

const IS_JPEG = (b: Uint8Array) => startsWith(b, [0xff, 0xd8, 0xff])
const IS_WAV = (b: Uint8Array) => startsWith(b, ascii('RIFF')) && startsWith(b, ascii('WAVE'), 8)
const IS_FTYP = (b: Uint8Array) => startsWith(b, ascii('ftyp'), 4)

const SIGNATURES: Record<string, (bytes: Uint8Array) => boolean> = {
  'image/jpeg': IS_JPEG,
  'image/jpg': IS_JPEG,
  'image/png': (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/gif': (b) => startsWith(b, ascii('GIF87a')) || startsWith(b, ascii('GIF89a')),
  'image/webp': (b) => startsWith(b, ascii('RIFF')) && startsWith(b, ascii('WEBP'), 8),
  'video/mp4': IS_FTYP,
  // Classic QuickTime files may start with a movie atom instead of ftyp
  'video/quicktime': (b) => ['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip', 'pnot'].some((atom) => startsWith(b, ascii(atom), 4)),
  'video/webm': (b) => startsWith(b, [0x1a, 0x45, 0xdf, 0xa3]),
  'video/mpeg': (b) => startsWith(b, [0x00, 0x00, 0x01, 0xba]) || startsWith(b, [0x00, 0x00, 0x01, 0xb3]),
  'application/pdf': (b) => startsWith(b, ascii('%PDF')),
  // ID3 tag, or an MPEG audio frame (11 sync bits)
  'audio/mpeg': (b) => startsWith(b, ascii('ID3')) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0),
  'audio/wav': IS_WAV,
  'audio/x-wav': IS_WAV,
  'audio/ogg': (b) => startsWith(b, ascii('OggS')),
}

/**
 * Whether the leading bytes fit the declared type. A type with no known
 * signature (a theme's own addition) is not checked here.
 */
export function bytesMatchMime(bytes: Uint8Array, mimeType: string): boolean {
  const matches = SIGNATURES[mimeType]
  return matches ? matches(bytes) : true
}
