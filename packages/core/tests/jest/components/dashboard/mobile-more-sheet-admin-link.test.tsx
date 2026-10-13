/**
 * The mobile "more" sheet links the admin panel for the roles that can open it: superadmin and developer.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

let role = 'member'
jest.mock('@/core/lib/auth-client', () => ({ useSession: () => ({ data: { user: { role } }, isPending: false }) }))
jest.mock('@/core/hooks/useAuth', () => ({ useAuth: () => ({ user: { email: 'u@x', firstName: 'U' }, signOut: jest.fn() }) }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/components/teams/TeamSwitcherCompact', () => ({ TeamSwitcherCompact: () => null }))
jest.mock('@/core/lib/config/config-client', () => ({ MOBILE_NAV_CONFIG: { moreSheetItems: [] } }))
jest.mock('@/core/lib/permissions/hooks', () => ({ usePermission: () => true }))
jest.mock('@/core/components/ui/sheet', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return { Sheet: Pass, SheetContent: Pass, SheetHeader: Pass, SheetTitle: Pass, SheetDescription: Pass }
})

import { MobileMoreSheet } from '@/core/components/dashboard/mobile/MobileMoreSheet'

it.each([['superadmin', true], ['developer', true], ['member', false]] as const)('as a %s, the admin panel link: %s', (r, shown) => {
  role = r
  render(<MobileMoreSheet isOpen onOpenChange={() => {}} />)
  expect(screen.queryByText('Super Admin Panel') !== null).toBe(shown)
})
