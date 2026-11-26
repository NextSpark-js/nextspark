/**
 * #543: every limit a template's billing config names as `billing.limits.<slug>` has a translated name in the six
 * catalogs, so the billing UI and the superadmin team detail do not fall back to the raw slug.
 */
import { describe, test, expect } from '@jest/globals'
import fs from 'node:fs'
import path from 'node:path'
import en from '@/core/messages/en/index'
import es from '@/core/messages/es/index'
import de from '@/core/messages/de/index'
import fr from '@/core/messages/fr/index'
import it_ from '@/core/messages/it/index'
import pt from '@/core/messages/pt/index'

const LOCALES = { en, es, de, fr, it: it_, pt } as Record<string, Record<string, any>>
const PROJECTS = path.join(__dirname, '../../../templates/projects')

const slugs = fs
  .readdirSync(PROJECTS)
  .map((d) => path.join(PROJECTS, d, 'config/billing.config.ts'))
  .filter((f) => fs.existsSync(f))
  .flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(/billing\.limits\.(\w+)/g)].map((m) => m[1]))

describe('billing limit names', () => {
  test('the templates name at least the projects limit', () => {
    expect(slugs).toContain('projects')
  })
  test.each(Object.keys(LOCALES))('%s has a name for every limit the templates use', (locale) => {
    const limits = LOCALES[locale].billing.limits
    for (const slug of new Set(slugs)) expect(typeof limits[slug]).toBe('string')
  })
})
