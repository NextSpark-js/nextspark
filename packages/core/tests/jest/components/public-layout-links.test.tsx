/**
 * @jest-environment jsdom
 *
 * The default public layout links only the routes core guarantees: /docs, sign-in and sign-up. Marketing pages
 * (/features, /pricing, /support, ...) exist only if a project writes them, and a link to one that is missing is a
 * request that answers 404 on every load (#404). A project that wants such navigation writes its own
 * (public)/layout.tsx.
 */
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/hooks/useAuth', () => ({ useAuth: () => ({ user: null, isLoading: false }) }))
jest.mock('@/core/components/app/misc/ThemeToggle', () => ({ ThemeToggle: () => null }))

import { PublicNavbar } from '@/core/components/app/layouts/PublicNavbar'
import { PublicFooter } from '@/core/components/app/layouts/PublicFooter'

const GUARANTEED = new Set(['/', '/docs', '/login', '/signup', '/dashboard'])

function internalHrefs(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('a'))
    .map(a => a.getAttribute('href') ?? '')
    .filter(href => href.startsWith('/'))
}

describe('default public layout links', () => {
  test('the navbar, with the mobile menu closed and open', () => {
    const { container } = render(<PublicNavbar />)
    const closed = internalHrefs(container)
    expect(closed).toContain('/docs')
    for (const href of closed) expect(GUARANTEED.has(href)).toBe(true)

    const toggle = container.querySelector('button.md\\:hidden') ?? screen.getAllByRole('button')[0]
    fireEvent.click(toggle)
    const open = internalHrefs(container)
    expect(open.length).toBeGreaterThan(closed.length)
    for (const href of open) expect(GUARANTEED.has(href)).toBe(true)
  })

  test('the footer', () => {
    const { container } = render(<PublicFooter />)
    const hrefs = internalHrefs(container)
    expect(hrefs).toContain('/docs')
    for (const href of hrefs) expect(GUARANTEED.has(href)).toBe(true)
  })
})
