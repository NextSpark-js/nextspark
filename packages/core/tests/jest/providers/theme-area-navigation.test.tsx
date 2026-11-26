/**
 * #554: on a client navigation from one area to another (dashboard, devtools, superadmin) the next area's ThemeArea can
 * mount later than the previous one unmounts (its layout streams), and the page must not fall back to the public theme
 * in between: that was one light frame with a dark account theme. Leaving for a public page still turns the area off.
 */
import React from 'react'
import { flushSync } from 'react-dom'
import { act, render } from '@testing-library/react'

jest.mock('next/navigation', () => ({ usePathname: () => window.location.pathname }))

import { ThemeProvider } from '@nextsparkjs/core/providers/theme-provider'
import { ThemeArea } from '@nextsparkjs/core/providers/theme-area'

const originalMatchMedia = window.matchMedia
beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('theme', 'dark')
  window.history.pushState({}, '', '/dashboard')
  document.documentElement.className = ''
  window.matchMedia = jest.fn((query: string) => ({ matches: true, media: query, addListener: jest.fn(), removeListener: jest.fn() })) as unknown as typeof window.matchMedia
})
afterEach(() => {
  window.matchMedia = originalMatchMedia
  window.history.pushState({}, '', '/')
})

const props = { attribute: 'class' as const, defaultTheme: 'system', enableSystem: true, disableTransitionOnChange: true }
const page = (area: React.ReactNode) => <ThemeProvider {...props}>{area}</ThemeProvider>

/** Every class <html> has between now and the end of `run`, one entry per change */
async function classesDuring(run: () => Promise<void>) {
  const seen: string[] = []
  const html = document.documentElement
  const observer = new MutationObserver(() => seen.push(html.className))
  observer.observe(html, { attributes: true, attributeFilter: ['class'] })
  await run()
  seen.push(...observer.takeRecords().map(() => html.className))
  observer.disconnect()
  return seen
}

it('the next area mounts in a later commit than the previous one unmounts: the page never turns light', async () => {
  const { rerender } = render(page(<ThemeArea key="a">x</ThemeArea>))
  await act(async () => {})
  expect(document.documentElement.className).toBe('dark')
  const seen = await classesDuring(async () => {
    // the router commits the new URL and takes the previous area out; the next one has not arrived
    window.history.pushState({}, '', '/devtools')
    await act(async () => rerender(page(<span />)))
    await act(async () => new Promise((r) => setTimeout(r, 50)))
    await act(async () => rerender(page(<ThemeArea key="b">y</ThemeArea>)))
  })
  expect(seen).not.toContain('light')
  expect(document.documentElement.className).toBe('dark')
})

it('the URL changes in the same tick as the cleanup, after the area is taken out: the public theme still applies (the microtask reads the new URL)', async () => {
  const { rerender } = render(page(<ThemeArea>x</ThemeArea>))
  await act(async () => {})
  expect(document.documentElement.className).toBe('dark')
  await act(async () => {
    // the area unmounts while the location is still /dashboard; the router changes it right after, in the same task
    flushSync(() => rerender(page(<span />)))
    window.history.pushState({}, '', '/pricing')
  })
  expect(document.documentElement.className).toBe('light')
})

it('leaving an area for a public page applies the public theme', async () => {
  const { rerender } = render(page(<ThemeArea>x</ThemeArea>))
  await act(async () => {})
  expect(document.documentElement.className).toBe('dark')
  window.history.pushState({}, '', '/pricing')
  await act(async () => rerender(page(<span />)))
  expect(document.documentElement.className).toBe('light')
})
