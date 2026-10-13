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
}

/** Extension for an allow-listed MIME type; `bin` for a type this table does not know (never served as a page). */
export function extensionForMime(mimeType: string): string {
  return EXTENSION_BY_MIME[mimeType] ?? 'bin'
}

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((value, index) => bytes[offset + index] === value)

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0))

const IS_JPEG = (b: Uint8Array) => startsWith(b, [0xff, 0xd8, 0xff])
const IS_FTYP = (b: Uint8Array) => startsWith(b, ascii('ftyp'), 4)

const SIGNATURES: Record<string, (bytes: Uint8Array) => boolean> = {
  'image/jpeg': IS_JPEG,
  'image/jpg': IS_JPEG,
  'image/png': (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/gif': (b) => startsWith(b, ascii('GIF87a')) || startsWith(b, ascii('GIF89a')),
  'image/webp': (b) => startsWith(b, ascii('RIFF')) && startsWith(b, ascii('WEBP'), 8),
  'video/mp4': IS_FTYP,
  'video/quicktime': IS_FTYP,
  'video/webm': (b) => startsWith(b, [0x1a, 0x45, 0xdf, 0xa3]),
  'video/mpeg': (b) => startsWith(b, [0x00, 0x00, 0x01, 0xba]) || startsWith(b, [0x00, 0x00, 0x01, 0xb3]),
  'application/pdf': (b) => startsWith(b, ascii('%PDF')),
}

/**
 * Whether the leading bytes fit the declared type. A type with no known
 * signature (a theme's own addition) is not checked here.
 */
export function bytesMatchMime(bytes: Uint8Array, mimeType: string): boolean {
  const matches = SIGNATURES[mimeType]
  return matches ? matches(bytes) : true
}
