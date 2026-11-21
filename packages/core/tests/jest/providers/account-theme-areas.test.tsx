/**
 * #495: the account theme is mounted by the layouts of the areas with a session (dashboard, devtools, superadmin),
 * not by DashboardProviders, which a public page can load too (the upgrade link of /403 wraps it).
 */
import React from 'react'
import { renderToString } from 'react-dom/server'

const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>

jest.mock('@/core/providers/account-theme', () => ({ AccountTheme: () => <i data-testid="account-theme" /> }))
jest.mock('@nextsparkjs/core/providers/account-theme', () => ({ AccountTheme: () => <i data-testid="account-theme" /> }))
jest.mock('@/core/providers/DashboardProviders', () => ({ DashboardProviders: Passthrough }))
jest.mock('@nextsparkjs/core/providers/DashboardProviders', () => ({ DashboardProviders: Passthrough }))
jest.mock('@nextsparkjs/core/components/app/guards/SuperAdminGuard', () => ({ SuperAdminGuard: Passthrough }))
jest.mock('@nextsparkjs/core/components/app/guards/DeveloperGuard', () => ({ DeveloperGuard: Passthrough }))
jest.mock('@nextsparkjs/core/components/superadmin/layouts/SuperadminSidebar', () => ({ SuperadminSidebar: () => null }))
jest.mock('@nextsparkjs/core/components/devtools/DevtoolsSidebar', () => ({ DevtoolsSidebar: () => null }))
jest.mock('@nextsparkjs/core/components/devtools/DevtoolsMobileHeader', () => ({ DevtoolsMobileHeader: () => null }))
jest.mock('@nextsparkjs/core/lib/plugins/nav-items', () => ({ getAllPluginNavItems: () => [] }))
jest.mock('next-intl', () => ({ NextIntlClientProvider: Passthrough, useTranslations: () => (key: string) => key }))
jest.mock('next-intl/server', () => ({ getMessages: async () => ({}), getTranslations: async () => (key: string) => key }))
jest.mock('next/navigation', () => ({ redirect: jest.fn(), useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/core/hooks/useAuth', () => ({ useAuth: () => ({ user: null, isLoading: true }) }))
jest.mock('@/core/hooks/useEnsureUserMetadata', () => ({ useEnsureUserMetadata: jest.fn() }))
jest.mock('@/core/hooks/useAuthMethodDetector', () => ({ useAuthMethodDetector: jest.fn() }))

import { AuthenticatedDashboardLayout } from '@/core/components/dashboard/layouts/AuthenticatedDashboardLayout'
import { DevLayout, guardDevtoolsLayout } from '../../../src/routes/_internal/devtools-layout'
import { SuperadminLayout, guardSuperadminLayout } from '../../../src/routes/_internal/superadmin-layout'

const ProjectLayout = ({ children }: { children?: React.ReactNode }) => <main>{children}</main>
const GuardedDevtools = guardDevtoolsLayout(ProjectLayout)
const GuardedSuperadmin = guardSuperadminLayout(ProjectLayout)

const count = (html: string) => html.split('data-testid="account-theme"').length - 1

describe('the areas with a session mount the account theme once', () => {
  it.each([
    ['the dashboard', <AuthenticatedDashboardLayout key="d">page</AuthenticatedDashboardLayout>],
    ['devtools', <DevLayout key="dt">page</DevLayout>],
    ['devtools around a project layout', <GuardedDevtools key="gdt">page</GuardedDevtools>],
    ['superadmin', <SuperadminLayout key="s">page</SuperadminLayout>],
    ['superadmin around a project layout', <GuardedSuperadmin key="gs">page</GuardedSuperadmin>],
  ])('%s', (_area, element) => {
    expect(count(renderToString(element))).toBe(1)
  })
})
