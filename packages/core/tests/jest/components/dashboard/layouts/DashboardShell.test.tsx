/**
 * DashboardShell — bypass block (WCAG 2.4.1).
 *
 * The sidebar and the top bar put about fifteen tab stops before the page content. The shell starts with a skip link
 * to the main landmark so a keyboard user does not tab through them on every page.
 */
import { describe, it, expect, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react'

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
jest.mock('@/core/contexts/sidebar-context', () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSidebar: () => ({ isCollapsed: false }),
}))
jest.mock('@/core/lib/entities/registry.client', () => ({ setServerEntities: jest.fn() }))
jest.mock('@/core/components/dashboard/layouts/Sidebar', () => ({ Sidebar: () => <nav>sidebar</nav> }))
jest.mock('@/core/components/dashboard/layouts/TopNavbar', () => ({ TopNavbar: () => <header>topnav</header> }))
jest.mock('@/core/components/dashboard/mobile/MobileTopBar', () => ({ MobileTopBar: () => <header>mobiletop</header> }))
jest.mock('@/core/components/dashboard/mobile/MobileBottomNav', () => ({ MobileBottomNav: () => <nav>mobilebottom</nav> }))

import { DashboardShell } from '@/core/components/dashboard/layouts/DashboardShell'

describe('DashboardShell', () => {
  it('starts with a skip link that targets the main landmark', () => {
    const { container } = render(
      <DashboardShell entities={[]}>
        <p>content</p>
      </DashboardShell>
    )
    const link = screen.getByRole('link', { name: 'a11y.skipToMainContent' })
    expect(link.getAttribute('href')).toBe('#main-content')
    // the first focusable element of the page
    expect(container.querySelector('a, button, input')).toBe(link)

    const main = screen.getByRole('main')
    expect(main.id).toBe('main-content')
    // programmatically focusable, so the browser moves focus there when the link is followed
    expect(main.getAttribute('tabindex')).toBe('-1')
  })
})
