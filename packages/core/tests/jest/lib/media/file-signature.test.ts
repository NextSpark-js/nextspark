import { describe, expect, it } from '@jest/globals'
import { bytesMatchMime, extensionForMime } from '@/core/lib/media/file-signature'

const bytes = (...values: number[]) => Uint8Array.from([...values, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
const text = (value: string) => new TextEncoder().encode(value.padEnd(16, '\0'))

describe('extensionForMime', () => {
  it('maps the allow-listed types and falls back to bin', () => {
    expect(extensionForMime('image/jpeg')).toBe('jpg')
    expect(extensionForMime('video/quicktime')).toBe('mov')
    expect(extensionForMime('text/html')).toBe('bin')
  })
})

describe('bytesMatchMime', () => {
  it.each([
    ['image/png', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)],
    ['image/jpeg', bytes(0xff, 0xd8, 0xff, 0xe0)],
    ['image/gif', text('GIF89a')],
    ['image/webp', text('RIFF\0\0\0\0WEBP')],
    ['video/mp4', text('\0\0\0\x18ftypisom')],
    ['video/webm', bytes(0x1a, 0x45, 0xdf, 0xa3)],
  ])('accepts real %s bytes', (mime, content) => {
    expect(bytesMatchMime(content, mime)).toBe(true)
  })

  it.each(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'])(
    'refuses markup declared as %s',
    (mime) => {
      expect(bytesMatchMime(text('<svg onload=alert(1)>'), mime)).toBe(false)
    }
  )

  it('does not judge a type it has no signature for', () => {
    expect(bytesMatchMime(text('anything'), 'application/x-theme-type')).toBe(true)
  })
})
