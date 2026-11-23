/**
 * #510: the pages outside the areas with a session (dashboard, devtools, superadmin) render in one theme, the default
 * when it is dark and light otherwise, whatever the visitor stored, their system or their account says; inside the
 * areas (wrapped in ThemeArea) the visitor's theme applies. The server reads no pathname and sends nothing more: the
 * blocking script decides from the browser's location, and so does the provider's first render in the browser, which
 * changes only what is applied, never what is rendered.
 */
import React from 'react'
import { act, render } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'

jest.mock('next/navigation', () => ({ usePathname: () => window.location.pathname }))

import { ThemeProvider, useTheme, type UseThemeProps } from '@nextsparkjs/core/providers/theme-provider'
import { ThemeArea } from '@nextsparkjs/core/providers/theme-area'

const originalMatchMedia = window.matchMedia
let prefersDark = true

/** A dark browser that stored dark: the public pages must still be light */
beforeEach(() => {
  prefersDark = true
  localStorage.clear()
  localStorage.setItem('theme', 'dark')
  document.documentElement.className = ''
  window.history.pushState({}, '', '/')
  window.matchMedia = jest.fn((query: string) => ({
    get matches() {
      return prefersDark && query === '(prefers-color-scheme: dark)'
    },
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia
})
const ORIGINAL_BASE_PATH = process.env.__NEXT_ROUTER_BASEPATH
afterEach(() => {
  window.matchMedia = originalMatchMedia
  window.history.pushState({}, '', '/')
  // process.env stores undefined as the string "undefined"
  if (ORIGINAL_BASE_PATH === undefined) delete process.env.__NEXT_ROUTER_BASEPATH
  else process.env.__NEXT_ROUTER_BASEPATH = ORIGINAL_BASE_PATH
})

/** What the root layouts pass with the toggle allowed and defaultMode 'system' */
const root = { attribute: 'class' as const, defaultTheme: 'system', enableSystem: true, disableTransitionOnChange: true }

/** Runs the blocking script the provider renders with `props` at `path`; the class it put on <html> */
function scriptClass(path: string, props: React.ComponentProps<typeof ThemeProvider> = root): string {
  window.history.pushState({}, '', path)
  const html = renderToString(<ThemeProvider {...props}><span /></ThemeProvider>)
  const code = html.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1]
  expect(code).toBeTruthy()
  document.documentElement.className = ''
  new Function(code!.replace(/&quot;/g, '"').replace(/&amp;/g, '&'))()
  return document.documentElement.className
}

describe('the blocking script', () => {
  it.each([
    ['/', 'light'],
    ['/pricing', 'light'],
    ['/login', 'light'],
    ['/dashboard-tour', 'light'],
    ['/dashboard', 'dark'],
    ['/dashboard/tasks', 'dark'],
    ['/devtools/blocks', 'dark'],
    ['/superadmin', 'dark'],
  ])('at %s applies %s, with a stored dark choice in a dark browser', (path, expected) => {
    expect(scriptClass(path)).toBe(expected)
  })

  it('applies a dark default as the public theme over a stored light choice', () => {
    localStorage.setItem('theme', 'light')
    expect(scriptClass('/', { ...root, defaultTheme: 'dark' })).toBe('dark')
  })

  it('matches the areas under the base path', () => {
    process.env.__NEXT_ROUTER_BASEPATH = '/app'
    expect(scriptClass('/app/dashboard/tasks')).toBe('dark')
    expect(scriptClass('/app')).toBe('light')
    expect(scriptClass('/dashboard')).toBe('light')
  })

  it('lets a forced theme win, on public pages and in the areas', () => {
    localStorage.setItem('theme', 'light')
    expect(scriptClass('/', { ...root, forcedTheme: 'dark' })).toBe('dark')
    expect(scriptClass('/dashboard', { ...root, forcedTheme: 'dark' })).toBe('dark')
  })

  it('sends nothing more than before: the areas and the public theme are not props or arguments of their own', () => {
    window.history.pushState({}, '', '/')
    const html = renderToString(<ThemeProvider {...root}><span /></ThemeProvider>)
    expect(html).toMatch(/\("class","theme","system",null,\["light","dark"\],null,true,true,""\)<\/script>/)
  })
})

/** Hydrates the server markup of `tree` at `path`, after running its scripts; every value `Probe` saw */
async function hydrateAt(path: string, tree: React.ReactElement, seen: UseThemeProps[]) {
  window.history.pushState({}, '', path)
  const container = document.createElement('div')
  container.innerHTML = renderToString(tree)
  seen.length = 0
  for (const script of container.querySelectorAll('script')) new Function(script.textContent ?? '')()
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
  document.body.appendChild(container)
  await act(async () => {
    hydrateRoot(container, tree)
  })
  container.remove()
  expect(errors).not.toHaveBeenCalled()
  errors.mockRestore()
}

describe('the provider', () => {
  it('keeps a public page in the public theme after hydration, and says so', async () => {
    const seen: UseThemeProps[] = []
    function Probe() {
      seen.push(useTheme())
      return null
    }
    await hydrateAt('/', <ThemeProvider {...root}><Probe /></ThemeProvider>, seen)
    expect(document.documentElement.className).toBe('light')
    expect(seen.at(-1)).toEqual(expect.objectContaining({ forcedTheme: 'light', theme: 'dark' }))
  })

  it('in an area, applies the stored theme after hydration and answers without the public theme inside ThemeArea', async () => {
    const outside: UseThemeProps[] = []
    const inside: UseThemeProps[] = []
    function Outside() {
      outside.push(useTheme())
      return null
    }
    function Inside() {
      inside.push(useTheme())
      return null
    }
    await hydrateAt('/dashboard', <ThemeProvider {...root}><Outside /><ThemeArea><Inside /></ThemeArea></ThemeProvider>, outside)
    expect(document.documentElement.className).toBe('dark')
    expect(inside.at(-1)?.forcedTheme).toBeUndefined()
    // The same answers in the server render and the hydration render: nothing rendered depends on the location
    expect(new Set(inside.map(v => v.forcedTheme))).toEqual(new Set([undefined]))
    expect(outside.at(-1)?.forcedTheme).toBe('light')
  })

  it.each([
    ['/dashboard-tour', 'light'],
    ['/dashboards', 'light'],
    ['/dashboard', 'dark'],
  ])('matches %s as an area only at a segment boundary after hydration too (%s)', async (path, expected) => {
    const seen: UseThemeProps[] = []
    function Probe() {
      seen.push(useTheme())
      return null
    }
    await hydrateAt(path, <ThemeProvider {...root}><Probe /></ThemeProvider>, seen)
    expect(document.documentElement.className).toBe(expected)
  })

  it('matches the areas under the base path after hydration too', async () => {
    process.env.__NEXT_ROUTER_BASEPATH = '/app'
    const seen: UseThemeProps[] = []
    function Probe() {
      seen.push(useTheme())
      return null
    }
    await hydrateAt('/app/dashboard', <ThemeProvider {...root}><Probe /></ThemeProvider>, seen)
    expect(document.documentElement.className).toBe('dark')
    await hydrateAt('/dashboard', <ThemeProvider {...root}><Probe /></ThemeProvider>, seen)
    expect(document.documentElement.className).toBe('light')
  })

  it('lets forcedThemeRoutes force a public route to another theme than the public one', async () => {
    const seen: UseThemeProps[] = []
    function Probe() {
      seen.push(useTheme())
      return null
    }
    await hydrateAt('/pricing', <ThemeProvider {...root} forcedThemeRoutes={{ '/pricing': 'dark' }}><Probe /></ThemeProvider>, seen)
    expect(document.documentElement.className).toBe('dark')
    expect(seen.at(-1)?.forcedTheme).toBe('dark')
  })

  it('keeps the visitor theme on an area page whose ThemeArea has not hydrated yet (it streams in later)', async () => {
    const seen: UseThemeProps[] = []
    function Probe() {
      seen.push(useTheme())
      return null
    }
    await hydrateAt('/dashboard/tasks', <ThemeProvider {...root}><Probe /></ThemeProvider>, seen)
    expect(document.documentElement.className).toBe('dark')
  })

  it('follows a client navigation into an area and out of it', async () => {
    let inArea = (show: boolean) => {}
    function Page() {
      const [area, setArea] = React.useState(false)
      inArea = setArea
      return area ? <ThemeArea><span /></ThemeArea> : <span />
    }
    render(<ThemeProvider {...root}><Page /></ThemeProvider>)
    expect(document.documentElement.className).toBe('light')
    await act(async () => inArea(true))
    expect(document.documentElement.className).toBe('dark')
    await act(async () => inArea(false))
    expect(document.documentElement.className).toBe('light')
  })

  it('keeps a dark default as the public theme from the first render in the browser, over a stored light choice', async () => {
    localStorage.setItem('theme', 'light')
    const seen: UseThemeProps[] = []
    function Probe() {
      seen.push(useTheme())
      return null
    }
    await hydrateAt('/', <ThemeProvider {...root} defaultTheme="dark"><Probe /></ThemeProvider>, seen)
    expect(document.documentElement.className).toBe('dark')
    expect(seen[0]?.forcedTheme).toBe('dark')
    expect(seen.at(-1)?.forcedTheme).toBe('dark')
  })

  it('applies the public theme whatever the system does', async () => {
    localStorage.setItem('theme', 'system')
    render(<ThemeProvider {...root}><span /></ThemeProvider>)
    expect(document.documentElement.className).toBe('light')
  })
})
