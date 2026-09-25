/**
 * ThemeProvider tests (#207)
 *
 * The generated root layout mounts ThemeProvider on every route, including
 * public ones. It used to read ThemeService.getCurrent()/getAll(), which
 * imports the full THEME_REGISTRY - the same object that also carries
 * dashboardConfig/appConfig/devConfig for the project. Because THEME_REGISTRY
 * is one static object literal, importing it at all pulled every field into
 * the client bundle: measured at a 67 KB minified chunk containing the
 * 116 KB generated registry plus dashboard/dev config, shipped to anonymous
 * visitors on every page.
 *
 * ThemeProvider now reads theme-registry.client.ts instead, which the
 * registry generator emits with only each theme's own ThemeConfig. The
 * source-text checks below are a regression guard for that specific bug
 * class: nothing about component behavior would fail if ThemeProvider
 * regressed to importing the full registry again, so the import itself is
 * asserted directly.
 */

import React from 'react'
import { readFileSync } from 'fs'
import { render, screen, waitFor } from '@testing-library/react'

describe('ThemeProvider source', () => {
  const source = readFileSync(
    require.resolve('@nextsparkjs/core/lib/theme/ThemeProvider'),
    'utf8'
  )

  it('imports the client-safe theme registry', () => {
    expect(source).toMatch(/@nextsparkjs\/registries\/theme-registry\.client/)
  })

  it('does not import the full server theme registry', () => {
    expect(source).not.toMatch(/@nextsparkjs\/registries\/theme-registry'/)
  })

  it('does not import ThemeService (pulls in dashboardConfig/appConfig/devConfig)', () => {
    expect(source).not.toMatch(/services\/theme\.service/)
    expect(source).not.toMatch(/\bThemeService\b/)
  })

  it('imports only a client-safe style applicator', () => {
    expect(source).toMatch(/\.\/theme-styles/)
    expect(source).not.toMatch(/theme-loader/)
  })
})

describe('client module registry boundaries', () => {
  const clientSources = [
    ['ThemeProvider', '@nextsparkjs/core/lib/theme/ThemeProvider'],
    ['useEntityTranslations', '@nextsparkjs/core/hooks/useEntityTranslations'],
    ['translations/registry', '@nextsparkjs/core/lib/translations/registry'],
    ['config-client', '@nextsparkjs/core/lib/config/config-client'],
  ] as const

  test.each(clientSources)('%s cannot import the server theme registry or ThemeService', (_name, modulePath) => {
    const source = readFileSync(require.resolve(modulePath), 'utf8')

    // Do not limit this to one import spelling: a barrel import of
    // ThemeService has the same server-registry side effect as importing its
    // source file directly. The `.client` registry is deliberately allowed.
    expect(source).not.toMatch(/\bThemeService\b/)
    expect(source).not.toMatch(/services\/theme\.service/)
    expect(source).not.toMatch(/@nextsparkjs\/registries\/theme-registry(?!\.client)/)
  })
})

describe('ThemeProvider', () => {
  const { ThemeProvider, useTheme } = require('@nextsparkjs/core/lib/theme/ThemeProvider')

  function Probe() {
    const { currentTheme, loading } = useTheme()
    if (loading) return <div data-testid="probe">loading</div>
    return (
      <div data-testid="probe">
        {currentTheme?.name ?? 'none'}
      </div>
    )
  }

  it('renders children', () => {
    render(
      <ThemeProvider>
        <span data-testid="child">hi</span>
      </ThemeProvider>
    )

    expect(screen.getByTestId('child')).toHaveTextContent('hi')
  })

  it('exposes the current theme from the client-safe registry', async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('probe')).toHaveTextContent('default')
    })
  })

  it('throws when useTheme is used outside a ThemeProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow('useTheme must be used within a ThemeProvider')
    spy.mockRestore()
  })
})
