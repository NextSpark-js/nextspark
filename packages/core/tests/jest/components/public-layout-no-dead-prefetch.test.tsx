/**
 * @jest-environment jsdom
 *
 * A link to a page the project may not have (the marketing links of the default public layout) must not be prefetched: the prefetch of a page that does not exist is a 404 in the console on every load
 * (#404).
 */
import { render } from '@testing-library/react'

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, prefetch, children, ...rest }: { href: string; prefetch?: boolean; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} data-prefetch={String(prefetch)} {...rest}>{children}</a>
  ),
}))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/hooks/useAuth', () => ({ useAuth: () => ({ user: null, isLoading: false }) }))
jest.mock('@/core/components/app/misc/ThemeToggle', () => ({ ThemeToggle: () => null }))

import { PublicNavbar } from '@/core/components/app/layouts/PublicNavbar'
import { PublicFooter } from '@/core/components/app/layouts/PublicFooter'

const MARKETING = ['/features', '/pricing', '/support', '/about', '/blog', '/contact']

function prefetchOf(container: HTMLElement, href: string): string[] {
  return Array.from(container.querySelectorAll(`a[href="${href}"]`)).map(a => a.getAttribute('data-prefetch') ?? '')
}

describe('links to pages a project may not have are not prefetched', () => {
  test('the default public navbar', () => {
    const { container } = render(<PublicNavbar />)
    for (const href of ['/features', '/pricing', '/support']) {
      const found = prefetchOf(container, href)
      expect(found.length).toBeGreaterThan(0)
      expect(found.every(p => p === 'false')).toBe(true)
    }
  })

  test('the default public footer', () => {
    const { container } = render(<PublicFooter />)
    for (const href of MARKETING) {
      const found = prefetchOf(container, href)
      expect(found.length).toBeGreaterThan(0)
      expect(found.every(p => p === 'false')).toBe(true)
    }
  })

})
