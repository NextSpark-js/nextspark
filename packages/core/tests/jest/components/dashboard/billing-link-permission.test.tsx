/**
 * Every entry that leads to the billing settings is for roles with `settings.billing`: the mobile menu of the top
 * navbar, the mobile "More" sheet, the dashboard quick actions and the 403 page's "View plans" link.
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

let canAccessBilling = true
const BILLING = '/dashboard/settings/billing'

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/lib/permissions/hooks', () => ({ usePermission: (p: string) => (p === 'settings.billing' ? canAccessBilling : true) }))
jest.mock('@/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'a@x.com', firstName: 'A', lastName: 'B' }, signOut: jest.fn(), isLoading: false }),
}))
jest.mock('@/core/hooks/useUserProfile', () => ({ useUserProfile: () => ({ user: { id: 'u1', firstName: 'A', email: 'a@x.com' }, isLoading: false }) }))
jest.mock('@/core/lib/auth/home-route', () => ({ resolveHomeRoute: () => '/dashboard' }))
jest.mock('@/core/lib/config/public-config-client', () => ({ DASHBOARD_HOME_CONFIG: undefined }))
jest.mock('@/core/lib/auth-client', () => ({ useSession: () => ({ data: { user: { role: 'member' } }, isPending: false }) }))
jest.mock('@/core/contexts/sidebar-context', () => ({ useSidebar: () => ({ isCollapsed: false, toggleSidebar: jest.fn() }) }))
jest.mock('@/core/components/app/guards/SuperAdminGuard', () => ({ useIsSuperAdmin: () => false, useCanAccessAdmin: () => false }))
jest.mock('@/core/components/app/guards/DeveloperGuard', () => ({ useIsDeveloper: () => false }))
jest.mock('@/core/components/app/misc/ThemeToggle', () => ({ ThemeToggle: () => null }))
jest.mock('@/core/components/dashboard/misc/NotificationsDropdown', () => ({ NotificationsDropdown: () => null }))
jest.mock('@/core/components/dashboard/misc/SearchDropdown', () => ({ SearchDropdown: () => null }))
jest.mock('@/core/components/dashboard/misc/QuickCreateDropdown', () => ({ QuickCreateDropdown: () => null }))
jest.mock('@/core/components/dashboard/navigation/DynamicNavigation', () => ({ DynamicNavigation: () => null }))
jest.mock('@/core/components/teams/TeamSwitcherCompact', () => ({ TeamSwitcherCompact: () => null }))
jest.mock('@/core/lib/config/config-client', () => ({
  APP_NAME: 'App',
  TOPBAR_CONFIG: { userMenu: { enabled: false, items: [] } },
  isTopbarFeatureEnabled: () => false,
  getTopbarFeatureConfig: () => undefined,
  MOBILE_NAV_CONFIG: {
    moreSheetItems: [
      { id: 'profile', labelKey: 'profile', href: '/dashboard/settings/profile', icon: 'User', enabled: true },
      { id: 'billing', labelKey: 'billing', href: BILLING, icon: 'CreditCard', enabled: true, requiresPermission: 'settings.billing' },
    ],
  },
}))
jest.mock('@/core/components/ui/sheet', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return { Sheet: Pass, SheetContent: Pass, SheetHeader: Pass, SheetTitle: Pass, SheetDescription: Pass }
})

import { TopNavbar } from '@/core/components/dashboard/layouts/TopNavbar'
import { MobileMoreSheet } from '@/core/components/dashboard/mobile/MobileMoreSheet'
import DashboardIndex from '@/core/routes/dashboard/(main)/page'

const hasBillingLink = () => screen.queryAllByRole('link').some(a => a.getAttribute('href') === BILLING)
const hasBillingButton = () => screen.queryByText('quickActions.billing') !== null

describe.each([true, false])('with settings.billing: %s', (allowed) => {
  beforeEach(() => { canAccessBilling = allowed })

  it('top navbar mobile menu', () => {
    render(<TopNavbar entities={[]} />)
    fireEvent.click(screen.getByLabelText('a11y.openNavigationMenu'))
    expect(hasBillingLink()).toBe(allowed)
    expect(screen.getAllByRole('link').some(a => a.getAttribute('href') === '/dashboard/settings/profile')).toBe(true)
  })

  it('mobile More sheet', () => {
    render(<MobileMoreSheet isOpen onOpenChange={() => {}} />)
    expect(hasBillingLink()).toBe(allowed)
    expect(screen.getAllByRole('link').some(a => a.getAttribute('href') === '/dashboard/settings/profile')).toBe(true)
  })

  it('dashboard quick actions', () => {
    render(<DashboardIndex />)
    expect(hasBillingButton()).toBe(allowed)
    expect(screen.queryByText('quickActions.settings') !== null).toBe(true)
  })
})

describe('the "More" sheet billing entry of the shipped configs', () => {
  it.each([
    ['core defaults', () => require('@/core/lib/config/app.config').DEFAULT_APP_CONFIG],
    ['starter template', () => require('../../../../templates/projects/starter/config/app.config').default],
  ])('%s requires settings.billing', (_name, load) => {
    const item = load().mobileNav.moreSheetItems.find((i: { id: string }) => i.id === 'billing')
    expect(item.requiresPermission).toBe('settings.billing')
  })
})
