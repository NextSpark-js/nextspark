/**
 * ThemeProvider reads the pathname only when the app declares forced routes.
 *
 * `usePathname()` is runtime data for a route with dynamic segments; with Cache Components a component that
 * reads it outside Suspense fails the prerender, and this provider is at the top of the root layout.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

const mockUsePathname = jest.fn(() => '/login')
jest.mock('next/navigation', () => ({ usePathname: () => mockUsePathname() }))

const mockNextThemesProvider = jest.fn(({ children }: { children: React.ReactNode }) => <>{children}</>)
jest.mock('next-themes', () => ({
  ThemeProvider: (props: Record<string, unknown> & { children: React.ReactNode }) => {
    mockNextThemesProvider(props)
    return <>{props.children}</>
  },
}))

import { ThemeProvider } from '@nextsparkjs/core/providers/theme-provider'

describe('ThemeProvider', () => {
  beforeEach(() => {
    mockUsePathname.mockClear()
    mockNextThemesProvider.mockClear()
  })

  it('does not read the pathname without forced routes', () => {
    render(
      <ThemeProvider attribute="class" forcedTheme="dark">
        <span data-testid="child">Content</span>
      </ThemeProvider>
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(mockUsePathname).not.toHaveBeenCalled()
    expect(mockNextThemesProvider).toHaveBeenCalledWith(expect.objectContaining({ forcedTheme: 'dark' }))
  })

  it('does not read the pathname for an empty route map', () => {
    render(<ThemeProvider forcedThemeRoutes={{}}><span /></ThemeProvider>)
    expect(mockUsePathname).not.toHaveBeenCalled()
  })

  it('forces the theme of the route the pathname matches, over the plain forcedTheme', () => {
    render(
      <ThemeProvider forcedThemeRoutes={{ '/login': 'light' }} forcedTheme="dark">
        <span />
      </ThemeProvider>
    )
    expect(mockUsePathname).toHaveBeenCalled()
    expect(mockNextThemesProvider).toHaveBeenCalledWith(expect.objectContaining({ forcedTheme: 'light' }))
  })

  it('keeps the plain forcedTheme on a route that is not forced', () => {
    mockUsePathname.mockReturnValueOnce('/dashboard')
    render(
      <ThemeProvider forcedThemeRoutes={{ '/login': 'light' }} forcedTheme="dark">
        <span />
      </ThemeProvider>
    )
    expect(mockNextThemesProvider).toHaveBeenCalledWith(expect.objectContaining({ forcedTheme: 'dark' }))
  })
})
