import { resolveLocalizedText } from '@/core/lib/blocks/localized-text'
import { isBlockConfig } from '@/core/types/blocks'

describe('resolveLocalizedText', () => {
  test('a string is the same in every locale', () => {
    expect(resolveLocalizedText('Hero', 'es')).toBe('Hero')
    expect(resolveLocalizedText('', 'es')).toBe('')
  })

  test('picks the entry of the locale', () => {
    const value = { en: 'Hero', es: 'Portada' }
    expect(resolveLocalizedText(value, 'en')).toBe('Hero')
    expect(resolveLocalizedText(value, 'es')).toBe('Portada')
  })

  test('a regional locale uses its language, then the default locale', () => {
    const value = { en: 'Hero', es: 'Portada' }
    expect(resolveLocalizedText(value, 'es-MX')).toBe('Portada')
    expect(resolveLocalizedText(value, 'de', 'es')).toBe('Portada')
  })

  test('falls back to en, then to the first entry, then to an empty string', () => {
    expect(resolveLocalizedText({ es: 'Portada', en: 'Hero' }, 'de')).toBe('Hero')
    expect(resolveLocalizedText({ es: 'Portada', fr: 'Accueil' }, 'de')).toBe('Portada')
    expect(resolveLocalizedText({}, 'de')).toBe('')
    expect(resolveLocalizedText(undefined, 'de')).toBe('')
  })
})

describe('isBlockConfig with localized texts', () => {
  const base = { slug: 'hero', category: 'hero', fieldDefinitions: [] }
  test('accepts a string or a map of strings for name and description', () => {
    expect(isBlockConfig({ ...base, name: 'Hero', description: 'd' })).toBe(true)
    expect(isBlockConfig({ ...base, name: { en: 'Hero' }, description: { en: 'd', es: 'd' } })).toBe(true)
  })
  test('rejects other shapes', () => {
    expect(isBlockConfig({ ...base, name: { en: 3 }, description: 'd' })).toBe(false)
    expect(isBlockConfig({ ...base, name: ['Hero'], description: 'd' })).toBe(false)
    expect(isBlockConfig({ ...base, name: null, description: 'd' })).toBe(false)
  })
})
