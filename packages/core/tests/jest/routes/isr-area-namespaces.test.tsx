/**
 * #427: the message wrappers of the ISR host (cacheComponents off) give each area the namespaces the project lists for
 * it in `i18n.clientNamespaces`, as the Cache Components wrappers do (group-layouts-request-locale.test.tsx).
 */
import React from 'react'

const selectMessages = jest.fn((..._args: unknown[]) => ({}))
const configured = { auth: ['project-a'], public: ['project-p'], devtools: ['project-dv'], dashboard: ['entity-d'], superadmin: ['role-s'] }

jest.mock('next-intl/server', () => ({ getMessages: async () => ({}), getTranslations: async () => (key: string) => key }))
jest.mock('next-intl', () => ({ NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children, useTranslations: () => (key: string) => key }))
jest.mock('@nextsparkjs/core/lib/i18n/client-messages', () => ({
  selectMessages: (...args: unknown[]) => selectMessages(...args),
  getConfiguredClientNamespaces: () => configured,
}))
jest.mock('@nextsparkjs/core/lib/config/config-client', () => ({ APP_CONFIG_MERGED: { i18n: { supportedLocales: ['en'], defaultLocale: 'en' } } }))
jest.mock('@nextsparkjs/core/lib/i18n/auth-translations', () => ({ getAuthTranslations: async () => (key: string) => key }))
jest.mock('../../../src/routes/_internal/area-access', () => ({ requireAreaAccess: async () => undefined }))
jest.mock('@nextsparkjs/core/components/app/guards/SuperAdminGuard', () => ({ SuperAdminGuard: () => null }))
jest.mock('@nextsparkjs/core/components/app/guards/DeveloperGuard', () => ({ DeveloperGuard: () => null }))
jest.mock('@nextsparkjs/core/providers/DashboardProviders', () => ({ DashboardProviders: () => null }))
jest.mock('@nextsparkjs/core/components/superadmin/layouts/SuperadminSidebar', () => ({ SuperadminSidebar: () => null }))
jest.mock('@nextsparkjs/core/components/devtools/DevtoolsSidebar', () => ({ DevtoolsSidebar: () => null }))
jest.mock('@nextsparkjs/core/components/devtools/DevtoolsMobileHeader', () => ({ DevtoolsMobileHeader: () => null }))
jest.mock('@nextsparkjs/core/components/dashboard/layouts/AuthenticatedDashboardLayout', () => ({ AuthenticatedDashboardLayout: () => null }))
jest.mock('@nextsparkjs/core/lib/plugins/nav-items', () => ({ getAllPluginNavItems: () => [] }))

import { withAuthMessages } from '../../../src/routes/_internal/auth-layout'
import { withPublicMessages } from '../../../src/routes/_internal/public-layout'
import { withDevtoolsMessages } from '../../../src/routes/_internal/devtools-layout'
import { withSuperadminMessages } from '../../../src/routes/_internal/superadmin-layout'
import CoreDashboardLayout from '../../../src/routes/dashboard/layout'

const Layout = ({ children }: { children: React.ReactNode }) => <>{children}</>

it.each([
  ['auth', () => withAuthMessages(Layout)({ children: null })],
  ['public', () => withPublicMessages(Layout)({ children: null })],
  ['devtools', () => withDevtoolsMessages(Layout)({ children: null })],
  ['superadmin', () => withSuperadminMessages(Layout)({ children: null })],
  ['dashboard', () => CoreDashboardLayout({ children: null })],
] as const)('the %s wrapper selects its area with the configured namespaces', async (area, render) => {
  selectMessages.mockClear()
  await render()
  expect(selectMessages.mock.calls[0].slice(1)).toEqual([area, configured[area]])
})
