/**
 * file, image, video and audio fields store what the upload API returned. A blob: URL only exists in the
 * tab that made it, so the generated schemas reject it; absolute URLs and this app's paths are accepted.
 */

jest.mock('server-only', () => ({}))

import { generateEntitySchemas } from '@/core/lib/entities/portable/schema-generator'
import type { EntityConfig } from '@/core/lib/entities/types'
import { FileText } from 'lucide-react'

const field = (name: string, type: string) => ({
  name,
  type,
  required: false,
  display: { label: name, description: '', showInList: true, showInDetail: true, showInForm: true, order: 1 },
  validation: {},
  api: { searchable: false, sortable: false, readOnly: false },
})

const schemas = generateEntitySchemas({
  slug: 'events',
  enabled: true,
  names: { singular: 'Event', plural: 'Events' },
  icon: FileText,
  access: { public: false, api: true, metadata: false, shared: false },
  ui: { dashboard: { showInMenu: false, showInTopbar: false }, public: { hasArchivePage: false, hasSinglePage: false }, features: {} },
  i18n: { fallbackLocale: 'en', loaders: { en: async () => ({}) } },
  fields: [field('attachment', 'file'), field('clip', 'video'), field('voice', 'audio'), field('cover', 'image')],
} as unknown as EntityConfig)

const item = (url: string) => ({ id: 'm1', name: 'a', size: 1, url })

describe.each(['attachment', 'clip', 'voice', 'cover'])('%s', (name) => {
  it.each([
    'https://cdn.example.test/uploads/a.bin',
    '/api/v1/media/files/a.bin',
  ])('accepts a stored file at %s', (url) => {
    expect(schemas.create.safeParse({ [name]: [item(url)] }).success).toBe(true)
  })

  it.each([
    'blob:http://localhost/9f1c0c1e',
    'BLOB:http://localhost/9f1c0c1e',
  ])('rejects the blob: URL %s', (url) => {
    expect(schemas.create.safeParse({ [name]: [item(url)] }).success).toBe(false)
  })

  it('rejects a protocol-relative URL', () => {
    expect(schemas.create.safeParse({ [name]: [item('//evil.example.test/a.bin')] }).success).toBe(false)
  })
})

describe('image as a single URL', () => {
  it('accepts a stored URL and a path of the app', () => {
    expect(schemas.create.safeParse({ cover: 'https://cdn.example.test/a.png' }).success).toBe(true)
    expect(schemas.create.safeParse({ cover: '/api/v1/media/files/a.png' }).success).toBe(true)
  })

  it('rejects a blob: URL', () => {
    expect(schemas.create.safeParse({ cover: 'blob:http://localhost/9f1c0c1e' }).success).toBe(false)
  })
})
