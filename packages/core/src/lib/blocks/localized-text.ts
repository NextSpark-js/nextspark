import type { LocalizedText } from '../../types/blocks'

/**
 * The text of a block name or description for `locale`. A string is returned as it is. For a map: the entry of the
 * locale, then of its language (`es-MX` -> `es`), then of `defaultLocale`, then `en`, then the first entry; an
 * empty string when there is none.
 */
export function resolveLocalizedText(value: LocalizedText | undefined, locale: string, defaultLocale?: string): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  const pick = (key?: string) => (key && typeof value[key] === 'string' ? value[key] : undefined)
  return pick(locale) ?? pick(locale.split('-')[0]) ?? pick(defaultLocale) ?? pick('en') ?? Object.values(value).find((text) => typeof text === 'string') ?? ''
}
