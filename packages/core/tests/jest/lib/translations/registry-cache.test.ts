/**
 * loadMergedTranslations caches the merged result for the life of the process in
 * production only; in development an edited message file shows on the next call.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'

const mockLoad = jest.fn<(theme: string, locale: string) => Promise<Record<string, unknown>>>()
jest.mock('@/core/lib/services/translation.service', () => ({
  TranslationService: {
    load: (theme: string, locale: string) => mockLoad(theme, locale),
    loadAllEntities: async () => ({}),
  },
}))

import { loadMergedTranslations } from '@/core/lib/translations/registry'

const env = process.env as Record<string, string | undefined>
const originalEnv = env.NODE_ENV

beforeEach(() => {
  delete (globalThis as Record<string, unknown>).__nextspark_translations_cache
  mockLoad.mockReset().mockResolvedValue({ regCacheTest: { greeting: 'v1' } })
})
afterEach(() => { env.NODE_ENV = originalEnv })

describe('loadMergedTranslations cache', () => {
  test('development: a changed message file is reflected on the next call', async () => {
    env.NODE_ENV = 'development'
    expect((await loadMergedTranslations('en')).regCacheTest).toEqual({ greeting: 'v1' })

    mockLoad.mockResolvedValue({ regCacheTest: { greeting: 'v2' } })

    expect((await loadMergedTranslations('en')).regCacheTest).toEqual({ greeting: 'v2' })
  })

  test('production: loads once and keeps serving from the cache', async () => {
    env.NODE_ENV = 'production'
    await loadMergedTranslations('en')
    const loads = mockLoad.mock.calls.length

    mockLoad.mockResolvedValue({ regCacheTest: { greeting: 'v2' } })

    expect((await loadMergedTranslations('en')).regCacheTest).toEqual({ greeting: 'v1' })
    expect(mockLoad).toHaveBeenCalledTimes(loads)
  })
})
