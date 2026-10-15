/**
 * Text fields in the generated create/update schemas: a default length limit when the field declares no
 * `maxLength` (64 KB for `text`, 1 MB for the long types), the declared `maxLength` when there is one, no NUL
 * character, and a required value of only whitespace counts as empty. Responses keep only the declared `maxLength`.
 */

jest.mock('server-only', () => ({}))

import { generateEntitySchemas, DEFAULT_TEXT_MAX_LENGTH, DEFAULT_LONG_TEXT_MAX_LENGTH } from '@/core/lib/entities/portable/schema-generator'
import type { EntityConfig } from '@/core/lib/entities/types'
import { FileText } from 'lucide-react'

const field = (name: string, type: string, extra: Record<string, unknown> = {}) => ({
  name,
  type,
  required: false,
  display: { label: name, description: '', showInList: true, showInDetail: true, showInForm: true, order: 1 },
  validation: {},
  api: { searchable: false, sortable: false, readOnly: false },
  ...extra,
})

const config = (fields: unknown[]) => ({
  slug: 'events',
  enabled: true,
  names: { singular: 'Event', plural: 'Events' },
  icon: FileText,
  access: { public: false, api: true, metadata: false, shared: false },
  ui: { dashboard: { showInMenu: false, showInTopbar: false }, public: { hasArchivePage: false, hasSinglePage: false }, features: {} },
  i18n: { fallbackLocale: 'en', loaders: { en: async () => ({}) } },
  fields,
}) as unknown as EntityConfig

describe('default text length limits', () => {
  const schemas = generateEntitySchemas(config([
    field('title', 'text'),
    field('body', 'textarea'),
    field('page', 'markdown'),
    field('doc', 'richtext'),
    field('snippet', 'code'),
    field('short', 'text', { maxLength: 10 }),
    field('big', 'text', { maxLength: 200_000 }),
  ]))

  test.each([
    ['text', 'title', DEFAULT_TEXT_MAX_LENGTH],
    ['textarea', 'body', DEFAULT_LONG_TEXT_MAX_LENGTH],
    ['markdown', 'page', DEFAULT_LONG_TEXT_MAX_LENGTH],
    ['richtext', 'doc', DEFAULT_LONG_TEXT_MAX_LENGTH],
    ['code', 'snippet', DEFAULT_LONG_TEXT_MAX_LENGTH],
  ])('a %s field without maxLength accepts its limit and refuses one more character', (_type, name, limit) => {
    expect(schemas.create.safeParse({ [name]: 'x'.repeat(limit) }).success).toBe(true)
    expect(schemas.create.safeParse({ [name]: 'x'.repeat(limit + 1) }).success).toBe(false)
    expect(schemas.update.safeParse({ [name]: 'x'.repeat(limit + 1) }).success).toBe(false)
  })

  test('the limits are 64 KB and 1 MB', () => {
    expect(DEFAULT_TEXT_MAX_LENGTH).toBe(65_536)
    expect(DEFAULT_LONG_TEXT_MAX_LENGTH).toBe(1_048_576)
  })

  test('a declared maxLength replaces the default, up or down', () => {
    expect(schemas.create.safeParse({ short: 'x'.repeat(11) }).success).toBe(false)
    expect(schemas.create.safeParse({ big: 'x'.repeat(DEFAULT_TEXT_MAX_LENGTH + 1) }).success).toBe(true)
    expect(schemas.create.safeParse({ big: 'x'.repeat(200_001) }).success).toBe(false)
  })

  test.each([['markdown', 'page'], ['richtext', 'doc'], ['code', 'snippet']])('the response schema leaves a long %s value unchecked, declared maxLength included', (_type, name) => {
    const declared = generateEntitySchemas(config([field(name, _type, { maxLength: 5 })]))
    const row = { id: 'a', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
    expect(declared.response.safeParse({ ...row, [name]: 'x'.repeat(50) }).success).toBe(true)
    expect(declared.create.safeParse({ [name]: 'x'.repeat(50) }).success).toBe(false)
  })

  test('the response schema applies no default limit', () => {
    expect(schemas.response.safeParse({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', title: 'x'.repeat(DEFAULT_TEXT_MAX_LENGTH + 1) }).success).toBe(true)
  })
})

describe('text values the database cannot hold or that are empty', () => {
  const schemas = generateEntitySchemas(config([field('title', 'text', { required: true }), field('body', 'markdown')]))

  test.each([['text', { title: 'a\u0000b' }], ['markdown', { title: 'ok', body: 'a\u0000b' }]])('a NUL character in a %s field is refused', (_type, data) => {
    expect(schemas.create.safeParse(data).success).toBe(false)
  })

  test.each([['spaces', '   '], ['tabs and a newline', '\t\n ']])('a required text field of only %s is refused', (_label, title) => {
    expect(schemas.create.safeParse({ title }).success).toBe(false)
  })

  test('surrounding whitespace is trimmed and the value kept', () => {
    const result = schemas.create.safeParse({ title: '  Rex  ' })
    expect(result.success && result.data.title).toBe('Rex')
  })
})
