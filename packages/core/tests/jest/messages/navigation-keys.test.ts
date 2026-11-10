/**
 * #413: navigation.json holds the same keys in every locale of the core catalog (the menu falls back to a key's name otherwise).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

const MESSAGES = path.join(__dirname, '../../../src/messages')
const LOCALES = ['en', 'es', 'de', 'fr', 'it', 'pt']
const keys = (locale: string) => Object.keys(JSON.parse(readFileSync(path.join(MESSAGES, locale, 'navigation.json'), 'utf8'))).sort()

describe('navigation.json', () => {
  test.each(LOCALES)('%s has the keys of English', locale => {
    expect(keys(locale)).toEqual(keys('en'))
  })
})
