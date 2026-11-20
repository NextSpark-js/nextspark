/**
 * The account theme in the areas with a session (#495). DashboardProviders mounts AccountTheme in the dashboard,
 * superadmin and devtools; public and auth pages never load it. Precedence: a forced theme, then the browser's stored
 * choice, then the account theme cookie, then the default.
 */

import React from 'react'
import { act, render } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'

jest.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }))

import { ThemeProvider, useTheme, type UseThemeProps } from '@nextsparkjs/core/providers/theme-provider'
import { AccountTheme } from '@nextsparkjs/core/providers/account-theme'

const originalMatchMedia = window.matchMedia

function clearCookies() {
  for (const name of ['nextspark.account_theme', 'x.nextspark.account_theme', 'a']) document.cookie = `${name}=; Max-Age=0; Path=/`
}

/** A light browser: prefers-color-scheme never matches dark */
beforeEach(() => {
  localStorage.clear()
  clearCookies()
  document.documentElement.className = ''
  window.matchMedia = jest.fn((query: string) => ({
    matches: false,
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
  clearCookies()
})

const toggle = { attribute: 'class' as const, defaultTheme: 'system', enableSystem: true, disableTransitionOnChange: true }

/** The server HTML of the area: the root provider's script and AccountTheme's */
function serverScripts(props: React.ComponentProps<typeof ThemeProvider> = toggle): string[] {
  const html = renderToString(<ThemeProvider {...props}><AccountTheme /></ThemeProvider>)
  return [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1])
}

/** Runs the scripts of a full page load, in document order */
function loadPage(props?: React.ComponentProps<typeof ThemeProvider>) {
  for (const code of serverScripts(props)) new Function(code)()
  return document.documentElement.className
}

describe('AccountTheme on a full page load of the area', () => {
  it.each([
    ['no cookie and no stored choice: the default', undefined, undefined, 'light', null],
    ['the account cookie and no stored choice: the account theme, stored', 'dark', undefined, 'dark', 'dark'],
    ['the account cookie and a stored choice: the stored choice', 'dark', 'light', 'light', 'light'],
    ['an account theme of "system": the device', 'system', undefined, 'light', 'system'],
    ['a cookie that names no theme: the default', 'neon', undefined, 'light', null],
  ])('the inline scripts apply, with %s', (_case, cookie: string | undefined, stored: string | undefined, expected, storedAfter) => {
    if (cookie) document.cookie = `nextspark.account_theme=${cookie}; Path=/`
    if (stored) localStorage.setItem('theme', stored)
    expect(loadPage()).toBe(expected)
    expect(localStorage.getItem('theme')).toBe(storedAfter)
  })

  it('finds the cookie among others, by its whole name', () => {
    document.cookie = 'x.nextspark.account_theme=light; Path=/'
    document.cookie = 'a=1; Path=/'
    document.cookie = 'nextspark.account_theme=dark; Path=/'
    expect(loadPage()).toBe('dark')
  })

  it('renders no script where the theme is forced', () => {
    document.cookie = 'nextspark.account_theme=dark; Path=/'
    const forced = { attribute: 'class' as const, defaultTheme: 'light', forcedTheme: 'light', enableSystem: false }
    expect(serverScripts(forced)).toHaveLength(1)
    expect(loadPage(forced)).toBe('light')
    expect(localStorage.getItem('theme')).toBeNull()
  })

  it('without "system" in play, an account theme of "system" is ignored', () => {
    document.cookie = 'nextspark.account_theme=system; Path=/'
    expect(loadPage({ attribute: 'class', defaultTheme: 'light', enableSystem: false })).toBe('light')
  })

  it('hydrates in the account theme, with no change after the scripts', async () => {
    document.cookie = 'nextspark.account_theme=dark; Path=/'
    const seen: string[] = []
    function Probe() {
      seen.push(useTheme().theme ?? '')
      return null
    }
    const tree = <ThemeProvider {...toggle}><AccountTheme /><Probe /></ThemeProvider>
    const container = document.createElement('div')
    container.innerHTML = renderToString(tree)
    seen.length = 0
    for (const script of container.querySelectorAll('script')) new Function(script.textContent ?? '')()
    expect(document.documentElement.className).toBe('dark')
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    document.body.appendChild(container)
    await act(async () => {
      hydrateRoot(container, tree)
    })
    container.remove()
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
    expect(new Set(seen)).toEqual(new Set(['dark']))
    expect(document.documentElement.className).toBe('dark')
  })
})

describe('AccountTheme on a client navigation into the area', () => {
  function mountArea(props: React.ComponentProps<typeof ThemeProvider> = toggle) {
    let api: UseThemeProps | undefined
    function Grab() {
      api = useTheme()
      return null
    }
    // The root provider was already on the page (the login form), the area mounts under it
    const { rerender, container } = render(<ThemeProvider {...props}><Grab /></ThemeProvider>)
    expect(document.documentElement.className).not.toBe('dark')
    document.cookie = 'nextspark.account_theme=dark; Path=/'
    rerender(<ThemeProvider {...props}><Grab /><AccountTheme /></ThemeProvider>)
    return { api: () => api!, container }
  }

  it('applies the account theme in the commit that mounts the area, without a script', () => {
    const { api, container } = mountArea()
    expect(document.documentElement.className).toBe('dark')
    expect(api().theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    // only the root provider's script, from the first render
    expect(container.querySelectorAll('script')).toHaveLength(1)
  })

  it('keeps a choice stored in this browser', () => {
    localStorage.setItem('theme', 'light')
    const { api } = mountArea()
    expect(api().theme).toBe('light')
    expect(document.documentElement.className).toBe('light')
  })

  it('leaves a forced theme alone', () => {
    const { api } = mountArea({ attribute: 'class', defaultTheme: 'light', forcedTheme: 'light', enableSystem: false })
    expect(document.documentElement.className).toBe('light')
    expect(localStorage.getItem('theme')).toBeNull()
    expect(api().forcedTheme).toBe('light')
  })
})
