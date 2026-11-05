/**
 * @jest-environment jsdom
 *
 * The dashboard help button opens a link from `topbar.support.links`, not a fixed `/support`: a project without that
 * page (the blog, CRM and productivity templates list only `/docs`) logged a 404 on every dashboard load (#403).
 * With no link there is no button.
 */
import { render, screen } from '@testing-library/react'

jest.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' }, signOut: jest.fn(), isLoading: false }),
}))
jest.mock('@/core/lib/permissions/hooks', () => ({ usePermission: () => true }))
jest.mock('@/core/contexts/sidebar-context', () => ({ useSidebar: () => ({ isCollapsed: false, toggleSidebar: jest.fn() }) }))
jest.mock('@/core/components/app/guards/SuperAdminGuard', () => ({ useIsSuperAdmin: () => false }))
jest.mock('@/core/components/app/guards/DeveloperGuard', () => ({ useIsDeveloper: () => false }))
jest.mock('@/core/components/app/misc/ThemeToggle', () => ({ ThemeToggle: () => null }))
jest.mock('@/core/components/dashboard/misc/NotificationsDropdown', () => ({ NotificationsDropdown: () => null }))
jest.mock('@/core/components/dashboard/misc/SearchDropdown', () => ({ SearchDropdown: () => null }))
jest.mock('@/core/components/dashboard/misc/QuickCreateDropdown', () => ({ QuickCreateDropdown: () => null }))
jest.mock('@/core/components/dashboard/navigation/DynamicNavigation', () => ({ DynamicNavigation: () => null }))
let mockSupport: { links?: { url?: string; action?: string }[] } = {}
jest.mock('@/core/lib/config/config-client', () => ({
  APP_NAME: 'App',
  APP_CONFIG_MERGED: { consent: { enabled: false } },
  TOPBAR_CONFIG: { userMenu: { enabled: true, items: [] } },
  isTopbarFeatureEnabled: (name: string) => name === 'support',
  getTopbarFeatureConfig: (name: string) => (name === 'support' ? mockSupport : undefined),
}))

import { TopNavbar } from '@/core/components/dashboard/layouts/TopNavbar'

const help = () => screen.queryByRole('link', { name: 'a11y.openHelpCenterNewTab' })

describe('TopNavbar help button', () => {
  test('opens /docs with the links of the blog, CRM and productivity templates', () => {
    mockSupport = { links: [{ url: '/docs' }] }
    render(<TopNavbar entities={[]} />)
    expect(help()?.getAttribute('href')).toBe('/docs')
  })

  test('keeps pointing at /support when the project lists it, as the starter does', () => {
    mockSupport = { links: [{ url: '/docs' }, { url: '/support' }, { action: 'showKeyboardShortcuts' }] }
    render(<TopNavbar entities={[]} />)
    expect(help()?.getAttribute('href')).toBe('/support')
  })

  test('is not rendered without a link', () => {
    mockSupport = { links: [{ action: 'showKeyboardShortcuts' }] }
    render(<TopNavbar entities={[]} />)
    expect(help()).toBeNull()
  })
})
