/**
 * The next-intl request config reads nothing from the request: reading headers
 * made every page dynamic, and the locale comes from getUserLocale.
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals'

jest.mock('next-intl/server', () => ({
  getRequestConfig: (factory: unknown) => factory,
}))

const mockHeaders = jest.fn(() => { throw new Error('headers() read by the request config') })
jest.mock('next/headers', () => ({
  headers: () => mockHeaders(),
  cookies: () => { throw new Error('cookies() read by the request config') },
}))

const mockGetUserLocale = jest.fn<() => Promise<string>>()
jest.mock('@/core/lib/locale', () => ({
  getUserLocale: () => mockGetUserLocale(),
}))

const mockLoadMergedTranslations = jest.fn<(locale: string) => Promise<Record<string, unknown>>>()
jest.mock('@/core/lib/translations/registry', () => ({
  loadMergedTranslations: (locale: string) => mockLoadMergedTranslations(locale),
}))

jest.mock('@/core/lib/translations/i18n-integration', () => ({ loadOptimizedTranslations: jest.fn() }))

import requestConfig from '@/core/i18n'
import { I18N_CONFIG } from '@/core/lib/config'

type Factory = (params: { locale?: string; requestLocale: Promise<string | undefined> }) => Promise<{ locale: string; messages: unknown }>
const factory = requestConfig as unknown as Factory

const otherLocale = I18N_CONFIG.supportedLocales.find(locale => locale !== I18N_CONFIG.defaultLocale) ?? I18N_CONFIG.defaultLocale

beforeEach(() => {
  mockHeaders.mockClear()
  mockGetUserLocale.mockReset().mockResolvedValue(I18N_CONFIG.defaultLocale)
  mockLoadMergedTranslations.mockReset().mockResolvedValue({ common: { ok: 'ok' } })
})

describe('i18n request config', () => {
  test('uses the locale it is given, without resolving it again or reading headers', async () => {
    const config = await factory({ locale: otherLocale, requestLocale: Promise.resolve(undefined) })

    expect(config.locale).toBe(otherLocale)
    expect(mockLoadMergedTranslations).toHaveBeenCalledWith(otherLocale)
    expect(mockGetUserLocale).not.toHaveBeenCalled()
    expect(mockHeaders).not.toHaveBeenCalled()
  })

  test('without one, asks getUserLocale, still without reading headers', async () => {
    mockGetUserLocale.mockResolvedValue(otherLocale)

    const config = await factory({ requestLocale: Promise.resolve(undefined) })

    expect(config.locale).toBe(otherLocale)
    expect(mockGetUserLocale).toHaveBeenCalledTimes(1)
    expect(mockHeaders).not.toHaveBeenCalled()
  })

  test('an unsupported locale it is given is resolved instead', async () => {
    await factory({ locale: 'xx', requestLocale: Promise.resolve(undefined) })

    expect(mockGetUserLocale).toHaveBeenCalledTimes(1)
  })
})
