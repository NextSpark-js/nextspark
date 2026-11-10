/**
 * The texts of an entity in the active locale (#421): its names, and the label, placeholder, description and option
 * labels of its fields, read from the entity's catalog (`entities/<slug>/messages/<locale>.json`, merged under the
 * `<slug>` namespace). The config stays the source: a key the catalog lacks gives the config's text.
 *
 * Catalog keys, relative to the entity's namespace:
 *   entity.singular, entity.plural
 *   fields.<field>.label, fields.<field>.placeholder, fields.<field>.description
 *   fields.<field>.options.<value>
 * A field's `display.labelKey` (a key from the catalog root) wins over `fields.<field>.label`.
 */

import type { EntityField, FieldOption } from './types'

/** The part of a next-intl translator this reads: a root one (`useTranslations()` / `getTranslations()`). */
export interface EntityTextTranslator {
  (key: string): string
  has?: (key: string) => boolean
}

/** The fields of an entity config this localizes; the rest of the object is kept as it is. */
export interface LocalizableEntity {
  slug: string
  names?: { singular: string; plural: string }
  fields?: EntityField[]
}

/** The catalog's text for `key`, or `fallback` when the catalog lacks it (or the translator cannot tell). */
export function entityText(t: EntityTextTranslator, key: string, fallback: string): string
export function entityText(t: EntityTextTranslator, key: string, fallback: string | undefined): string | undefined
export function entityText(t: EntityTextTranslator, key: string, fallback: string | undefined): string | undefined {
  try {
    return typeof t.has === 'function' && t.has(key) ? t(key) : fallback
  } catch {
    return fallback
  }
}

function localizeOption(t: EntityTextTranslator, prefix: string, option: FieldOption): FieldOption {
  const label = entityText(t, `${prefix}.options.${option.value}`, option.label)
  return label === option.label ? option : { ...option, label }
}

/** `items` mapped, or `items` itself when no item changed (so an entity without a catalog keeps its own objects). */
function mapSame<T>(items: T[], map: (item: T) => T): T[] {
  const mapped = items.map(map)
  return mapped.some((item, index) => item !== items[index]) ? mapped : items
}

/** A field with its label, placeholder, description and option labels in the active locale. */
export function localizeEntityField(t: EntityTextTranslator, slug: string, field: EntityField): EntityField {
  const prefix = `${slug}.fields.${field.name}`
  const display = field.display
  let localized = field
  if (display) {
    const ownLabel = entityText(t, `${prefix}.label`, display.label)
    const label = display.labelKey ? entityText(t, display.labelKey, ownLabel) : ownLabel
    const placeholder = entityText(t, `${prefix}.placeholder`, display.placeholder)
    const description = entityText(t, `${prefix}.description`, display.description)
    if (label !== display.label || placeholder !== display.placeholder || description !== display.description) {
      localized = { ...localized, display: { ...display, label, placeholder, description } }
    }
  }
  if (field.options) {
    const options = mapSame(field.options, option => localizeOption(t, prefix, option))
    if (options !== field.options) localized = { ...localized, options }
  }
  if (field.relation?.options) {
    const options = mapSame(field.relation.options, option => localizeOption(t, prefix, option))
    if (options !== field.relation.options) localized = { ...localized, relation: { ...field.relation, options } }
  }
  return localized
}

/**
 * The entity config with its names and fields in the active locale; everything else is the config's own. The config
 * itself comes back when its catalog has none of these keys.
 */
export function localizeEntityConfig<T extends LocalizableEntity>(config: T, t: EntityTextTranslator): T {
  const { slug, names, fields } = config
  const singular = names && entityText(t, `${slug}.entity.singular`, names.singular)
  const plural = names && entityText(t, `${slug}.entity.plural`, names.plural)
  const localizedFields = fields && mapSame(fields, field => localizeEntityField(t, slug, field))
  const namesChanged = names && (singular !== names.singular || plural !== names.plural)
  if (!namesChanged && localizedFields === fields) return config
  return {
    ...config,
    ...(namesChanged && { names: { ...names, singular, plural } }),
    ...(localizedFields !== fields && { fields: localizedFields }),
  }
}

/** Field types whose value is a name a person reads, so it can title a record. */
const TITLE_FIELD_TYPES = new Set(['text', 'email', 'url', 'phone'])

function readable(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number') return String(value)
  return undefined
}

/**
 * The name of one record: its `title` or `name`, else the first text column of the entity's list (the field the list
 * leads with), else `fallback`.
 */
export function getRecordTitle(
  config: Pick<LocalizableEntity, 'fields'> & { access?: { public?: boolean } },
  record: Record<string, unknown> | undefined | null,
  fallback: string,
): string {
  if (!record) return fallback
  const own = readable(record.title) ?? readable(record.name)
  if (own) return own
  const leading = (config.fields ?? [])
    .filter(field => field.display?.showInList && TITLE_FIELD_TYPES.has(field.type))
    .filter(field => field.name !== 'slug' || config.access?.public === true)
    .sort((a, b) => (a.display.order ?? 0) - (b.display.order ?? 0))
  for (const field of leading) {
    const value = readable(record[field.name])
    if (value) return value
  }
  return readable(record.displayName) ?? fallback
}

/**
 * An entity name inside a sentence ("Manage your tasks"). Lower case, except in German, where nouns are capitalized.
 */
export function entityNameInText(name: string, locale: string): string {
  return locale.split('-')[0] === 'de' ? name : name.toLocaleLowerCase(locale)
}
