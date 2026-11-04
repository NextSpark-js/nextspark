/**
 * The root ThemeProvider.
 *
 * - It reads the pathname only when the app declares forced routes: `usePathname()` is runtime data for a route with
 *   dynamic segments, and with Cache Components a component that reads it outside Suspense fails the prerender.
 * - Its context value does not change between the hydration render and the mount effects, whatever
 *   `prefers-color-scheme` says. A new value above a Suspense boundary that has not hydrated yet makes React discard
 *   that boundary's server HTML and render it again, losing what the visitor typed (#371).
 */

import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'

const mockUsePathname = jest.fn(() => '/login')
jest.mock('next/navigation', () => ({ usePathname: () => mockUsePathname() }))

import { ThemeProvider, useTheme, type UseThemeProps } from '@nextsparkjs/core/providers/theme-provider'

function ForcedTheme() {
  return <span data-testid="forced">{useTheme().forcedTheme ?? 'none'}</span>
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    mockUsePathname.mockClear()
    localStorage.clear()
  })

  it('does not read the pathname without forced routes', () => {
    render(
      <ThemeProvider attribute="class" forcedTheme="dark">
        <ForcedTheme />
      </ThemeProvider>
    )
    expect(screen.getByTestId('forced')).toHaveTextContent('dark')
    expect(mockUsePathname).not.toHaveBeenCalled()
  })

  it('does not read the pathname for an empty route map', () => {
    render(<ThemeProvider forcedThemeRoutes={{}}><span /></ThemeProvider>)
    expect(mockUsePathname).not.toHaveBeenCalled()
  })

  it('forces the theme of the route the pathname matches, over the plain forcedTheme', () => {
    render(
      <ThemeProvider forcedThemeRoutes={{ '/login': 'light' }} forcedTheme="dark">
        <ForcedTheme />
      </ThemeProvider>
    )
    expect(mockUsePathname).toHaveBeenCalled()
    expect(screen.getByTestId('forced')).toHaveTextContent('light')
  })

  it('keeps the plain forcedTheme on a route that is not forced', () => {
    mockUsePathname.mockReturnValueOnce('/dashboard')
    render(
      <ThemeProvider forcedThemeRoutes={{ '/login': 'light' }} forcedTheme="dark">
        <ForcedTheme />
      </ThemeProvider>
    )
    expect(screen.getByTestId('forced')).toHaveTextContent('dark')
  })
})

describe('ThemeProvider context across hydration (#371)', () => {
  const originalMatchMedia = window.matchMedia
  let prefersDark = true

  /** A browser whose prefers-color-scheme is dark, unless a test says otherwise */
  beforeEach(() => {
    prefersDark = true
    localStorage.clear()
    document.documentElement.className = ''
    window.matchMedia = jest.fn((query: string) => ({
      matches: prefersDark && query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })) as unknown as typeof window.matchMedia
  })
  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  /** Hydrates server markup and returns every context value the consumer rendered with, effects flushed */
  async function contextValuesAcrossHydration(props: React.ComponentProps<typeof ThemeProvider>): Promise<UseThemeProps[]> {
    const seen: UseThemeProps[] = []
    function Probe() {
      seen.push(useTheme())
      return <span>probe</span>
    }
    const tree = <ThemeProvider attribute="class" disableTransitionOnChange {...props}><Probe /></ThemeProvider>
    const container = document.createElement('div')
    container.innerHTML = renderToString(tree)
    seen.length = 0
    document.body.appendChild(container)
    await act(async () => {
      hydrateRoot(container, tree)
    })
    container.remove()
    return seen
  }

  it.each([
    ['the visitor can toggle', { defaultTheme: 'light', enableSystem: true }, undefined],
    ['the theme is forced', { defaultTheme: 'light', forcedTheme: 'light', enableSystem: false }, undefined],
    ['the visitor stored light', { defaultTheme: 'system', enableSystem: true }, 'light'],
  ])('keeps one context value from the hydration render through the mount effects when %s', async (_case, props, stored: string | undefined) => {
    if (stored) localStorage.setItem('theme', stored)
    const values = await contextValuesAcrossHydration(props)
    expect(values.length).toBeGreaterThan(0)
    expect(new Set(values).size).toBe(1)
    if (props.enableSystem) expect(values[0].systemTheme).toBe('dark')
  })

  it('still resolves "system" to the browser preference', async () => {
    const values = await contextValuesAcrossHydration({ defaultTheme: 'system', enableSystem: true })
    expect(values.at(-1)).toEqual(expect.objectContaining({ theme: 'system', resolvedTheme: 'dark' }))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it.each([
    ['dark', true],
    ['light', false],
  ])('resolves a forced "system" to the device preference (%s) in the blocking script and after hydration', async (scheme, dark) => {
    prefersDark = dark
    // What the root layouts pass for allowUserToggle: false with defaultMode 'system'
    const props = { attribute: 'class' as const, defaultTheme: 'system', forcedTheme: 'system', enableSystem: true }
    const html = renderToString(<ThemeProvider {...props}><span /></ThemeProvider>)
    const code = html.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1]
    expect(code).toBeTruthy()
    new Function(code!)()
    expect(document.documentElement.className).toBe(scheme)
    const values = await contextValuesAcrossHydration(props)
    expect(new Set(values).size).toBe(1)
    expect(document.documentElement.className).toBe(scheme)
  })

  it('stores and applies the theme setTheme chooses', async () => {
    let api: UseThemeProps | undefined
    function Grab() {
      api = useTheme()
      return null
    }
    render(<ThemeProvider attribute="class" defaultTheme="light" enableSystem><Grab /></ThemeProvider>)
    expect(document.documentElement.className).toBe('light')
    await act(async () => api!.setTheme('dark'))
    expect(api!.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(document.documentElement.className).toBe('dark')
  })
})
