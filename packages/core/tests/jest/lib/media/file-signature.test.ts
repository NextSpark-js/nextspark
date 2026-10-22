import { describe, expect, it } from '@jest/globals'
import { bytesMatchMime, extensionForMime, isInlineType } from '@/core/lib/media/file-signature'
import { allowedMimeTypes } from '@/core/lib/media/upload-limits'

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
    ['application/pdf', text('%PDF-1.7')],
    ['audio/mpeg', text('ID3\x04')],
    ['audio/mpeg', bytes(0xff, 0xfb, 0x90, 0x00)],
    ['audio/wav', text('RIFF\0\0\0\0WAVEfmt ')],
    ['audio/x-wav', text('RIFF\0\0\0\0WAVEfmt ')],
    ['audio/ogg', text('OggS')],
  ])('accepts real %s bytes', (mime, content) => {
    expect(bytesMatchMime(content, mime)).toBe(true)
  })

  it.each(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'application/pdf', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg'])(
    'refuses markup declared as %s',
    (mime) => {
      expect(bytesMatchMime(text('<svg onload=alert(1)>'), mime)).toBe(false)
    }
  )

  it.each(['ftyp', 'moov', 'mdat', 'wide', 'free'])('accepts a QuickTime file whose first atom is %s', (atom) => {
    expect(bytesMatchMime(text(`\0\0\0\x18${atom}`), 'video/quicktime')).toBe(true)
  })

  it('refuses markup declared as video/quicktime', () => {
    expect(bytesMatchMime(text('<svg onload=alert(1)>'), 'video/quicktime')).toBe(false)
  })

  it('refuses other formats declared as audio or PDF', () => {
    expect(bytesMatchMime(text('RIFF\0\0\0\0AVI LIST'), 'audio/wav')).toBe(false) // RIFF, but not WAVE
    expect(bytesMatchMime(bytes(0xff, 0x00, 0x00), 'audio/mpeg')).toBe(false) // no sync bits
    expect(bytesMatchMime(bytes(0x89, 0x50, 0x4e, 0x47), 'audio/ogg')).toBe(false)
    expect(bytesMatchMime(bytes(0x89, 0x50, 0x4e, 0x47), 'application/pdf')).toBe(false)
  })

  it('maps audio types to their extension and never serves them inline', () => {
    expect(extensionForMime('audio/mpeg')).toBe('mp3')
    expect(extensionForMime('audio/x-wav')).toBe('wav')
    expect(extensionForMime('audio/ogg')).toBe('ogg')
    for (const type of ['application/pdf', 'audio/mpeg', 'audio/wav', 'audio/ogg']) expect(isInlineType(type)).toBe(false)
  })

  it('has PDF and audio in the default allowed types', () => {
    expect(allowedMimeTypes()).toEqual(expect.arrayContaining(['application/pdf', 'audio/mpeg', 'audio/wav', 'audio/ogg']))
  })

  it('does not judge a type it has no signature for', () => {
    expect(bytesMatchMime(text('anything'), 'application/x-theme-type')).toBe(true)
  })
})
