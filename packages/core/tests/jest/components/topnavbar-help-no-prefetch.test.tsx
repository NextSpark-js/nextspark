/**
 * @jest-environment jsdom
 *
 * The dashboard help button opens /support in a new tab, which not every project has: it is not prefetched, since the
 * prefetch of a page that does not exist is a 404 in the console on every dashboard load (#403).
 */
import { render, screen } from '@testing-library/react'

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, prefetch, children, ...rest }: { href: string; prefetch?: boolean; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} data-prefetch={String(prefetch)} {...rest}>{children}</a>
  ),
}))
jest.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' }, signOut: jest.fn(), isLoading: false }),
}))
jest.mock('@/core/components/app/misc/ThemeToggle', () => ({ ThemeToggle: () => null }))
jest.mock('@/core/lib/permissions/hooks', () => ({ usePermission: () => true }))
jest.mock('@/core/contexts/sidebar-context', () => ({ useSidebar: () => ({ isCollapsed: false, toggleSidebar: jest.fn() }) }))
jest.mock('@/core/components/app/guards/SuperAdminGuard', () => ({ useIsSuperAdmin: () => false }))
jest.mock('@/core/components/app/guards/DeveloperGuard', () => ({ useIsDeveloper: () => false }))
jest.mock('@/core/components/dashboard/misc/NotificationsDropdown', () => ({ NotificationsDropdown: () => null }))
jest.mock('@/core/components/dashboard/misc/SearchDropdown', () => ({ SearchDropdown: () => null }))
jest.mock('@/core/components/dashboard/misc/QuickCreateDropdown', () => ({ QuickCreateDropdown: () => null }))
jest.mock('@/core/components/dashboard/navigation/DynamicNavigation', () => ({ DynamicNavigation: () => null }))
jest.mock('@/core/lib/config/config-client', () => ({
  APP_NAME: 'App',
  APP_CONFIG_MERGED: { consent: { enabled: false } },
  TOPBAR_CONFIG: { userMenu: { enabled: true, items: [] } },
  isTopbarFeatureEnabled: (name: string) => name === 'support',
  getTopbarFeatureConfig: () => undefined,
}))

import { TopNavbar } from '@/core/components/dashboard/layouts/TopNavbar'

describe('TopNavbar help button', () => {
  test('the dashboard help button', () => {
    render(<TopNavbar entities={[]} />)
    expect(screen.getByRole('link', { name: 'a11y.openHelpCenterNewTab' }).getAttribute('data-prefetch')).toBe('false')
  })
})
