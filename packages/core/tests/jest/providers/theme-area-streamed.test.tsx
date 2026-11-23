/**
 * #546: on a page that streams (devtools, superadmin) the root provider can hydrate before the area's inline script
 * runs. The script then stores the account theme and applies it, and ThemeArea's layout effect makes the provider follow
 * what is stored, so it does not put its own `system` theme back.
 */
import React from 'react'
import { act, render } from '@testing-library/react'

jest.mock('next/navigation', () => ({ usePathname: () => '/devtools' }))

import { ThemeProvider, useTheme } from '@nextsparkjs/core/providers/theme-provider'
import { ThemeArea } from '@nextsparkjs/core/providers/theme-area'

const originalMatchMedia = window.matchMedia

beforeEach(() => {
  window.history.pushState({}, '', '/devtools')
  localStorage.clear()
  document.documentElement.className = ''
  window.matchMedia = jest.fn((query: string) => ({ matches: false, media: query, addListener: jest.fn(), removeListener: jest.fn() })) as unknown as typeof window.matchMedia
})
afterEach(() => {
  window.matchMedia = originalMatchMedia
  window.history.pushState({}, '', '/')
})

it('a streamed area whose inline script ran after the root provider hydrated: the provider follows the stored theme', async () => {
  let theme = ''
  function Probe() {
    theme = useTheme().theme ?? ''
    return null
  }
  const props = { attribute: 'class' as const, defaultTheme: 'system', enableSystem: true, disableTransitionOnChange: true }
  const { rerender } = render(<ThemeProvider {...props}><span /></ThemeProvider>)
  // the area's inline script, streamed later: stores the account theme and applies it
  localStorage.setItem('theme', 'dark')
  document.documentElement.className = 'dark'
  await act(async () => {
    rerender(<ThemeProvider {...props}><ThemeArea><Probe /></ThemeArea></ThemeProvider>)
  })
  expect(theme).toBe('dark')
  expect(document.documentElement.className).toBe('dark')
})
