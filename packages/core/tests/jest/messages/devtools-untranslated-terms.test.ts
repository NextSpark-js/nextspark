/**
 * #508: the non-English devtools catalogs do not keep the English words "Features", "Request" and "Dashboard"
 * (German keeps "Request", the usual word there) mixed into translated text.
 */
import { describe, test, expect } from '@jest/globals'
import es from '@/core/messages/es/index'
import de from '@/core/messages/de/index'
import fr from '@/core/messages/fr/index'
import it_ from '@/core/messages/it/index'
import pt from '@/core/messages/pt/index'

function values(node: unknown): string[] {
  return Object.values(node as Record<string, unknown>).flatMap((v) => (v && typeof v === 'object' ? values(v) : [String(v)]))
}

const LOCALES: Record<string, { devtools: unknown }> = { es, de, fr, it: it_, pt } as never
const TERMS: [RegExp, string[]][] = [
  [/\bfeatures?\b/i, []],
  [/\brequests?\b/i, ['de']],
  [/\bdashboard\b/i, []],
]

describe.each(Object.keys(LOCALES))('%s devtools messages (#508)', (locale) => {
  test.each(TERMS.filter(([, allowed]) => !allowed.includes(locale)))('have no English %s', (term) => {
    expect(values(LOCALES[locale].devtools).filter((text) => term.test(text))).toEqual([])
  })
})
