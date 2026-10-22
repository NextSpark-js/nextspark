/**
 * #331: the messages of the generated schemas can be translated (`translate` option), a field can replace any of them
 * (`display.validationMessages`) and can name itself by a message key (`display.labelKey`). Without the option the
 * text is what the generator always said, and the `en` catalog says the same.
 */

import { generateEntitySchemas } from '@/core/lib/entities/schema-generator'
import { fieldValidationMessage } from '@/core/lib/entities/portable/schema-generator'
import { createValidationTranslator } from '@/core/lib/entities/validation-translator'
import type { EntityConfig } from '@/core/lib/entities/types'
import en from '@/core/messages/en/index'
import es from '@/core/messages/es/index'
import de from '@/core/messages/de/index'
import fr from '@/core/messages/fr/index'
import itMessages from '@/core/messages/it/index'
import pt from '@/core/messages/pt/index'

const display = (label: string, extra: Record<string, unknown> = {}) => ({ label, showInList: true, showInDetail: true, showInForm: true, order: 1, ...extra })
const field = (name: string, type: string, label: string, extra: Record<string, unknown> = {}, displayExtra: Record<string, unknown> = {}) =>
  ({ name, type, required: false, display: display(label, displayExtra), api: { readOnly: false }, ...extra })

const ENTITY = {
  slug: 'pets',
  names: { singular: 'Pet', plural: 'Pets' },
  fields: [
    field('name', 'text', 'Name', { required: true }),
    field('contact', 'email', 'Contact'),
    field('site', 'url', 'Site'),
    field('phone', 'phone', 'Phone'),
    field('age', 'number', 'Age', { min: 1, max: 30 }),
    field('range', 'range', 'Range', {}),
    field('born', 'date', 'Born'),
    field('seen', 'datetime', 'Seen'),
    field('kind', 'select', 'Kind', { options: [{ value: 'dog' }, { value: 'cat' }] }),
    field('currency', 'currency', 'Currency'),
    field('country', 'country', 'Country'),
    field('bio', 'textarea', 'Bio', { maxLength: 5 }),
  ],
} as unknown as EntityConfig

const BAD = {
  name: '', contact: 'nope', site: 'http://', phone: 'x', age: 0, born: 'soon', seen: 'later', kind: 5, currency: 'EURO', country: 'ARG', bio: 'too long for five',
}

const messages = (config: EntityConfig, translate?: ReturnType<typeof createValidationTranslator>, data: Record<string, unknown> = BAD) => {
  const result = generateEntitySchemas(config, { translate }).create.safeParse(data)
  expect(result.success).toBe(false)
  const issues = result.success ? [] : result.error.issues
  return Object.fromEntries(issues.map(issue => [String(issue.path[0]), issue.message]))
}

const LOCALES = { es, de, fr, it: itMessages, pt } as Record<string, Record<string, unknown>>

describe('English text', () => {
  it('is what the generator always said, without the option', () => {
    expect(messages(ENTITY)).toMatchObject({
      name: 'Name is required',
      contact: 'Contact must be a valid email address',
      site: 'Site must be a valid URL',
      phone: 'Phone must be a valid phone number',
      age: 'Age must be at least 1',
      born: 'Born must be a valid date (YYYY-MM-DD)',
      kind: 'Kind must be one of: dog, cat',
      currency: 'Currency must be a valid 3-letter currency code',
      country: 'Country must be a valid 2-letter country code',
      bio: 'Bio cannot exceed 5 characters',
    })
  })

  it('is the same through the `en` catalog, for every message kind', () => {
    const data = { ...BAD, age: 99, range: [1], seen: 'later' }
    expect(messages(ENTITY, createValidationTranslator(en), data)).toEqual(messages(ENTITY, undefined, data))
    expect(messages(ENTITY, createValidationTranslator(en))).toEqual(messages(ENTITY))
  })

  it('is the same through the `en` catalog for every kind it declares, and every locale declares the same kinds', () => {
    const kinds = Object.keys(en.validation.entity)
    expect(kinds).toHaveLength(20)
    const sample = field('x', 'text', 'Label')
    for (const kind of kinds) {
      const params = { min: 1, max: 5, values: 'a, b' }
      expect(fieldValidationMessage(sample, kind as never, params, createValidationTranslator(en))).toBe(fieldValidationMessage(sample, kind as never, params))
    }
    for (const catalog of Object.values(LOCALES)) {
      expect(Object.keys((catalog as { validation: { entity: object } }).validation.entity)).toEqual(kinds)
    }
  })

  it('is kept for a key the catalogs do not have', () => {
    expect(messages(ENTITY, createValidationTranslator({})).name).toBe('Name is required')
  })
})

describe.each(Object.keys(LOCALES))('%s catalog', (locale) => {
  const translate = createValidationTranslator(LOCALES[locale])
  const out = messages(ENTITY, translate)
  const english = messages(ENTITY)

  it('translates the main message kinds and keeps the label and values', () => {
    for (const key of ['name', 'contact', 'site', 'age', 'kind', 'bio']) {
      expect(out[key]).not.toBe(english[key])
    }
    expect(out.name).toContain('Name')
    expect(out.age).toContain('1')
    expect(out.kind).toContain('dog, cat')
    expect(out.bio).toContain('5')
    expect(out.age).not.toContain('{')
    expect(out.kind).not.toContain('{')
  })

  it('translates max too', () => {
    const max = messages(ENTITY, translate, { name: 'x', age: 99 }).age
    expect(max).toContain('30')
    expect(max).not.toBe('Age must be at most 30')
  })
})

describe('two locales', () => {
  it('give different text for the same failure', () => {
    expect(messages(ENTITY, createValidationTranslator(es)).name).toBe('Name es obligatorio')
    expect(messages(ENTITY, createValidationTranslator(de)).name).toBe('Name ist erforderlich')
  })
})

describe('display.labelKey', () => {
  const entity = (labelKey?: string) => ({ ...ENTITY, fields: [field('name', 'text', 'Name', { required: true }, labelKey ? { labelKey } : {})] }) as unknown as EntityConfig
  const catalog = { pets: { name: 'Nombre' } }

  it('names the field with the translated label, and with the label when the key has no message', () => {
    expect(messages(entity('pets.name'), createValidationTranslator(es, catalog), {}).name).toBe('Nombre es obligatorio')
    expect(messages(entity('pets.missing'), createValidationTranslator(es, catalog), {}).name).toBe('Name es obligatorio')
    expect(messages(entity('pets.name'), undefined, {}).name).toBe('Name is required')
  })
})

describe('display.validationMessages', () => {
  const entity = { ...ENTITY, fields: [
    field('name', 'text', 'Name', { required: true }, { validationMessages: { required: 'Tell us the {label}' } }),
    field('age', 'number', 'Age', { min: 1 }, { validationMessages: { min: '{label} starts at {min}' } }),
    field('contact', 'email', 'Contact'),
  ] } as unknown as EntityConfig

  it('replaces the message of that kind, in every locale, and only for that field', () => {
    for (const translate of [undefined, createValidationTranslator(es)]) {
      const out = messages(entity, translate, { name: '', age: 0, contact: 'nope' })
      expect(out.name).toBe('Tell us the Name')
      expect(out.age).toBe('Age starts at 1')
      expect(out.contact).toBe(translate ? 'Contact debe ser un correo electrónico válido' : 'Contact must be a valid email address')
    }
  })
})
