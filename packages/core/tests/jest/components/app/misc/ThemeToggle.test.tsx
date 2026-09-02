/**
 * ThemeToggle hides itself when the theme is forced.
 *
 * Found in the integration E2E run: with `ui.theme.allowUserToggle: false`
 * the root layout forces the theme (#79) but the topbar still rendered the
 * selector, offering a change next-themes would ignore. The same applies to
 * routes forced via `forcedThemeRoutes` (#80).
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

const mockUseTheme = jest.fn()
jest.mock('next-themes', () => ({
  useTheme: () => mockUseTheme(),
}))
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
jest.mock('@/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: null }),
}))

import { ThemeToggle } from '@/core/components/app/misc/ThemeToggle'

describe('ThemeToggle', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders nothing when next-themes reports a forced theme', () => {
    mockUseTheme.mockReturnValue({ theme: 'dark', forcedTheme: 'dark', setTheme: jest.fn() })

    const { container } = render(<ThemeToggle />)

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders the toggle button when the user may change the theme', () => {
    mockUseTheme.mockReturnValue({ theme: 'system', forcedTheme: undefined, setTheme: jest.fn() })

    render(<ThemeToggle />)

    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})
