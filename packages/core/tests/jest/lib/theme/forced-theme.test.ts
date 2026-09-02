/**
 * @jest-environment jsdom
 */

import { describe, test, expect } from '@jest/globals'
import { resolveForcedTheme, type ForcedThemeRoutes } from '@/core/lib/theme/forced-theme'

describe('resolveForcedTheme', () => {
  const routes: ForcedThemeRoutes = {
    '/login': 'light',
    '/signup': 'light',
    '/embed': 'dark',
    '/embed/preview': 'light',
  }

  test('returns undefined when there is no pathname or no routes', () => {
    expect(resolveForcedTheme(null, routes)).toBeUndefined()
    expect(resolveForcedTheme(undefined, routes)).toBeUndefined()
    expect(resolveForcedTheme('', routes)).toBeUndefined()
    expect(resolveForcedTheme('/login', undefined)).toBeUndefined()
    expect(resolveForcedTheme('/login', null)).toBeUndefined()
    expect(resolveForcedTheme('/login', {})).toBeUndefined()
  })

  test('matches exact routes', () => {
    expect(resolveForcedTheme('/login', routes)).toBe('light')
    expect(resolveForcedTheme('/embed', routes)).toBe('dark')
  })

  test('matches nested routes under a prefix (segment boundary)', () => {
    expect(resolveForcedTheme('/login/verify', routes)).toBe('light')
    expect(resolveForcedTheme('/embed/widget/123', routes)).toBe('dark')
  })

  test('does not match partial segments', () => {
    expect(resolveForcedTheme('/login-help', routes)).toBeUndefined()
    expect(resolveForcedTheme('/embedded', routes)).toBeUndefined()
  })

  test('returns undefined for routes that are not forced', () => {
    expect(resolveForcedTheme('/', routes)).toBeUndefined()
    expect(resolveForcedTheme('/dashboard', routes)).toBeUndefined()
    expect(resolveForcedTheme('/dashboard/login', routes)).toBeUndefined()
  })

  test('the most specific (longest) prefix wins', () => {
    expect(resolveForcedTheme('/embed/preview', routes)).toBe('light')
    expect(resolveForcedTheme('/embed/preview/x', routes)).toBe('light')
    expect(resolveForcedTheme('/embed/other', routes)).toBe('dark')
  })

  test('root prefix forces every route', () => {
    expect(resolveForcedTheme('/anything/here', { '/': 'dark' })).toBe('dark')
    expect(resolveForcedTheme('/', { '/': 'dark' })).toBe('dark')
    // but a more specific prefix still overrides it
    expect(resolveForcedTheme('/login', { '/': 'dark', '/login': 'light' })).toBe('light')
  })

  test('ignores trailing slashes, query strings and hashes', () => {
    expect(resolveForcedTheme('/login/', routes)).toBe('light')
    expect(resolveForcedTheme('/login?redirect=%2Fdashboard', routes)).toBe('light')
    expect(resolveForcedTheme('/login#form', routes)).toBe('light')
    expect(resolveForcedTheme('/login', { 'login/': 'light' })).toBe('light')
  })

  test('ignores invalid theme values', () => {
    const invalid = { '/login': 'system', '/signup': 'blue' } as unknown as ForcedThemeRoutes
    expect(resolveForcedTheme('/login', invalid)).toBeUndefined()
    expect(resolveForcedTheme('/signup', invalid)).toBeUndefined()
  })
})
