/**
 * Settings layout — bypass block (WCAG 2.4.1). Same skip link as the dashboard shell, so the settings pages have
 * one too: it is the first focusable element and targets the page's main landmark.
 */
import { describe, it, expect, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('next/navigation', () => ({ usePathname: () => '/dashboard/settings/profile', notFound: jest.fn() }))
jest.mock('@nextsparkjs/core/lib/config/config-client', () => ({ isSettingsPageEnabled: () => true }))
jest.mock('@nextsparkjs/core/components/settings/layouts/SettingsSidebar', () => ({ SettingsSidebar: () => <nav>settings</nav> }))
jest.mock('@nextsparkjs/core/components/dashboard/mobile/MobileTopBar', () => ({ MobileTopBar: () => <header>top</header> }))
jest.mock('@nextsparkjs/core/components/dashboard/mobile/MobileBottomNav', () => ({ MobileBottomNav: () => <nav>bottom</nav> }))

import SettingsLayout from '@/core/routes/dashboard/settings/layout'

describe('SettingsLayout', () => {
  it('starts with a skip link to its main landmark', () => {
    const { container } = render(
      <SettingsLayout>
        <p>content</p>
      </SettingsLayout>
    )
    const link = screen.getByRole('link', { name: 'a11y.skipToMainContent' })
    expect(link.getAttribute('href')).toBe('#main-content')
    expect(container.querySelector('a, button, input')).toBe(link)
    const main = screen.getByRole('main')
    expect(main.id).toBe('main-content')
    expect(main.getAttribute('tabindex')).toBe('-1')
  })
})
