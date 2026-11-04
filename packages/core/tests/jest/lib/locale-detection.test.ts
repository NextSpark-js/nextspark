/** i18n.detectionStrategy at runtime: only an array counts (#379). */
import { isSourceEnabled, isLocaleFixedFor } from '@/core/lib/config/locale-detection'

const base = { supportedLocales: ['en', 'es'] }

describe('isSourceEnabled', () => {
  let warn: jest.SpyInstance
  beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => warn.mockRestore())

  test.each([[true], [{}], ['header'], [42]])('a non-array (%p) leaves every source on and does not throw', value => {
    const config = { ...base, detectionStrategy: value }
    expect(isSourceEnabled(config, 'header')).toBe(true)
    expect(isSourceEnabled(config, 'cookie')).toBe(true)
    expect(isLocaleFixedFor(config)).toBe(false)
  })

  test('warns about a non-array and about an unknown source, in development', () => {
    jest.resetModules()
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fresh = require('@/core/lib/config/locale-detection') as typeof import('@/core/lib/config/locale-detection')
    fresh.isSourceEnabled({ ...base, detectionStrategy: { x: 1 } }, 'cookie')
    fresh.isSourceEnabled({ ...base, detectionStrategy: ['cookies'] }, 'cookie')
    expect(warn).toHaveBeenCalledTimes(2)
  })

  test('an array turns only the listed sources on', () => {
    const config = { ...base, detectionStrategy: ['cookie', 'default'] }
    expect(isSourceEnabled(config, 'cookie')).toBe(true)
    expect(isSourceEnabled(config, 'header')).toBe(false)
  })
})
