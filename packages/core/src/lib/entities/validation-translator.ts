/**
 * A ValidationTranslator (the `translate` option of `generateEntitySchemas`, #331) that reads message catalogs such as
 * core's `messages/<locale>` (the `validation.entity.*` keys) or a project's own, and fills the `{placeholders}`.
 * The first catalog that has a key wins, so a project's messages can come before core's. A key no catalog has gives
 * undefined, which leaves the English text.
 */

import type { ValidationTranslator } from './portable/schema-generator'

export function createValidationTranslator(...catalogs: Array<Record<string, unknown>>): ValidationTranslator {
  return (key, values) => {
    for (const catalog of catalogs) {
      const message = key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), catalog)
      if (typeof message === 'string') {
        return message.replace(/\{(\w+)\}/g, (placeholder, name: string) => (name in values ? String(values[name]) : placeholder))
      }
    }
    return undefined
  }
}
