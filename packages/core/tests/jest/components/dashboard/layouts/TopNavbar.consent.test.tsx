/**
 * TopNavbar — cookie consent (#272): the user menu has a "Cookie settings" item when consent is enabled, so a choice
 * made in the dashboard can be withdrawn there.
 */
import { describe, it, expect, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }))
jest.mock('@/core/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' },
    signOut: jest.fn(),
    isLoading: false,
  }),
}))
jest.mock('@/core/contexts/sidebar-context', () => ({ useSidebar: () => ({ isCollapsed: false, toggleSidebar: jest.fn() }) }))
jest.mock('@/core/components/app/guards/SuperAdminGuard', () => ({ useIsSuperAdmin: () => false }))
jest.mock('@/core/components/app/guards/DeveloperGuard', () => ({ useIsDeveloper: () => false }))
jest.mock('@/core/components/app/misc/ThemeToggle', () => ({ ThemeToggle: () => null }))
jest.mock('@/core/components/dashboard/misc/NotificationsDropdown', () => ({ NotificationsDropdown: () => null }))
jest.mock('@/core/components/dashboard/misc/SearchDropdown', () => ({ SearchDropdown: () => null }))
jest.mock('@/core/components/dashboard/misc/QuickCreateDropdown', () => ({ QuickCreateDropdown: () => null }))
jest.mock('@/core/components/dashboard/navigation/DynamicNavigation', () => ({ DynamicNavigation: () => null }))
let mockConsent = true
jest.mock('@/core/lib/config/config-client', () => ({
  APP_NAME: 'App',
  get APP_CONFIG_MERGED() {
    return { consent: { enabled: mockConsent } }
  },
  TOPBAR_CONFIG: { userMenu: { enabled: true, items: [] } },
  isTopbarFeatureEnabled: () => false,
  getTopbarFeatureConfig: () => undefined,
}))
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { name?: string }) => (values?.name ? `${key} ${values.name}` : key),
}))

import { CONSENT_OPEN_EVENT } from '@/core/lib/consent/cookie'
import { TopNavbar } from '@/core/components/dashboard/layouts/TopNavbar'

const openMenu = () => {
  const trigger = document.querySelector('button[aria-haspopup="menu"][data-cy*="user"], button[aria-haspopup="menu"]') as HTMLElement
  // jsdom has no PointerEvent, so Radix's trigger is opened the way a keyboard does
  fireEvent.keyDown(trigger, { key: 'Enter' })
}

describe('TopNavbar user menu and cookie consent', () => {
  it('offers "Cookie settings", which asks the banner to open, when consent is enabled', async () => {
    mockConsent = true
    const opened = jest.fn()
    window.addEventListener(CONSENT_OPEN_EVENT, opened)
    render(<TopNavbar entities={[]} />)
    openMenu()
    fireEvent.click(await screen.findByRole('menuitem', { name: 'cookieSettings' }))
    window.removeEventListener(CONSENT_OPEN_EVENT, opened)
    expect(opened).toHaveBeenCalledTimes(1)
  })

  it('has no such item when consent is off', async () => {
    mockConsent = false
    render(<TopNavbar entities={[]} />)
    openMenu()
    await screen.findAllByRole('menu')
    expect(screen.queryByRole('menuitem', { name: 'cookieSettings' })).toBeNull()
  })
})
