/**
 * #546: the inline theme scripts (the root provider's and ThemeArea's account theme) run from the server HTML only, so
 * the browser bundle of a Next.js app carries none of their code: Next defines `process.env.NEXT_RUNTIME` in each
 * bundle ("" in the browser, with Turbopack and webpack alike), and the client renders the scripts empty. Hydrating the server HTML with
 * that client changes nothing and warns about nothing.
 */
import type * as ReactNS from 'react'

jest.mock('next/navigation', () => ({ usePathname: () => window.location.pathname }))

type Modules = {
  React: typeof ReactNS
  server: typeof import('react-dom/server')
  client: typeof import('react-dom/client')
  act: typeof ReactNS.act
  provider: typeof import('@nextsparkjs/core/providers/theme-provider')
  area: typeof import('@nextsparkjs/core/providers/theme-area')
}

/** A fresh copy of React and the theme modules, with NEXT_RUNTIME as `runtime` (Next's browser bundle has "") */
function load(runtime: string | undefined): Modules {
  const previous = process.env.NEXT_RUNTIME
  if (runtime === undefined) delete process.env.NEXT_RUNTIME
  else process.env.NEXT_RUNTIME = runtime
  let modules: Modules | undefined
  jest.isolateModules(() => {
    const React = require('react')
    modules = {
      React,
      act: React.act,
      server: require('react-dom/server'),
      client: require('react-dom/client'),
      provider: require('@nextsparkjs/core/providers/theme-provider'),
      area: require('@nextsparkjs/core/providers/theme-area'),
    }
  })
  if (previous === undefined) delete process.env.NEXT_RUNTIME
  else process.env.NEXT_RUNTIME = previous
  return modules!
}

const props = { attribute: 'class' as const, defaultTheme: 'system', enableSystem: true }
const tree = ({ React, provider, area }: Modules) =>
  React.createElement(provider.ThemeProvider, props, React.createElement(area.ThemeArea, null, React.createElement('span')))

const scripts = (html: string) => [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1])

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})
beforeEach(() => {
  window.history.pushState({}, '', '/dashboard')
  localStorage.clear()
  document.cookie = 'nextspark.account_theme=dark; Path=/'
  window.matchMedia = jest.fn((query: string) => ({ matches: false, media: query, addListener: jest.fn(), removeListener: jest.fn() })) as unknown as typeof window.matchMedia
})
afterEach(() => {
  document.cookie = 'nextspark.account_theme=; Max-Age=0; Path=/'
  window.history.pushState({}, '', '/')
})

describe('the inline theme scripts in a Next.js browser bundle', () => {
  it('outside a Next.js build (the server render here) both scripts carry their code', () => {
    const modules = load(undefined)
    const html = modules.server.renderToString(tree(modules))
    const code = scripts(html)
    expect(code).toHaveLength(2)
    for (const c of code) expect(c.length).toBeGreaterThan(100)
  })

  it('the browser bundle renders them empty, and hydrating the server HTML keeps their code and warns about nothing', async () => {
    const serverSide = load(undefined)
    const container = document.createElement('div')
    container.innerHTML = serverSide.server.renderToString(tree(serverSide))
    const before = scripts(container.innerHTML)

    const browser = load('')
    // what the browser renders on its own: the same elements, with no code
    expect(scripts(browser.server.renderToString(tree(browser)))).toEqual(['', ''])

    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    document.body.appendChild(container)
    await browser.act(async () => {
      browser.client.hydrateRoot(container, tree(browser))
    })
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
    // the root provider's script stays as the server sent it; ThemeArea's leaves after hydration
    expect(scripts(container.innerHTML)).toEqual(before.slice(0, 1))
    container.remove()
  })
})
