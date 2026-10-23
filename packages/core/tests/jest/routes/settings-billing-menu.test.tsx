/**
 * The billing entry of the settings menu (sidebar and overview cards) is for roles with `settings.billing`;
 * for the rest the page only redirects back, so the link is not shown.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

const usePermission = jest.fn()

jest.mock('next/navigation', () => ({ usePathname: () => '/dashboard/settings' }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@nextsparkjs/core/lib/permissions/hooks', () => ({ usePermission: (p: string) => usePermission(p) }))
jest.mock('../../../src/lib/permissions/hooks', () => ({ usePermission: (p: string) => usePermission(p) }))
jest.mock('../../../src/hooks/useUserProfile', () => ({ useUserProfile: () => ({ hasPassword: true }) }))
jest.mock('../../../src/hooks/usePrefetch', () => ({ usePrefetchSettings: () => ({ prefetchProfile: jest.fn(), prefetchTeams: jest.fn() }) }))
const pages = [{ key: 'profile', order: 1 }, { key: 'billing', order: 2 }]
jest.mock('@nextsparkjs/core/lib/config/config-client', () => ({ getEnabledSettingsPages: () => pages }))
jest.mock('../../../src/lib/config/config-client', () => ({ getEnabledSettingsPages: () => pages }))

import { SettingsSidebar } from '../../../src/components/settings/layouts/SettingsSidebar'
import SettingsPage from '../../../src/routes/dashboard/settings/page'

const hrefs = () => screen.getAllByRole('link').map(a => a.getAttribute('href'))

describe.each([
  ['sidebar', () => <SettingsSidebar />],
  ['overview', () => <SettingsPage />],
])('%s', (_name, ui) => {
  test('with settings.billing: billing is listed', () => {
    usePermission.mockReturnValue(true)
    render(ui())
    expect(hrefs()).toContain('/dashboard/settings/billing')
  })

  test('without settings.billing: billing is not listed, the other pages are', () => {
    usePermission.mockReturnValue(false)
    render(ui())
    expect(hrefs()).not.toContain('/dashboard/settings/billing')
    expect(hrefs()).toContain('/dashboard/settings/profile')
  })
})
