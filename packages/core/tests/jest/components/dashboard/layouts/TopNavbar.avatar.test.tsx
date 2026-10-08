/**
 * TopNavbar — with `topbar.userMenu.enabled: false` the avatar is a bare circle. Its initials come from CSS, so the
 * name has to sit on an element with a role that allows one (a `div` with only aria-label fails axe's
 * aria-prohibited-attr and is not announced).
 */
import { describe, it, expect, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react'

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
jest.mock('@/core/lib/config/config-client', () => ({
  APP_NAME: 'App',
  TOPBAR_CONFIG: { userMenu: { enabled: false, items: [] } },
  isTopbarFeatureEnabled: () => false,
  getTopbarFeatureConfig: () => undefined,
}))
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { name?: string }) => (values?.name ? `${key} ${values.name}` : key),
}))

import { TopNavbar } from '@/core/components/dashboard/layouts/TopNavbar'

describe('TopNavbar without the user menu', () => {
  it('names the avatar as an image', () => {
    render(<TopNavbar entities={[]} />)
    expect(screen.getByRole('img', { name: /Ada/ })).toBeTruthy()
  })
})
