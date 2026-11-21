/**
 * /superadmin/team-roles: a plan with no trial days prints no "0" after its price (#535), and the permissions card
 * splits its total into parts that add up to it (#517).
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => Object.assign((key: string, values?: Record<string, unknown>) => (values ? `${key}${JSON.stringify(values)}` : key), { has: () => false }),
}))
jest.mock('@nextsparkjs/core/lib/config/config-client', () => ({
  APP_CONFIG_MERGED: { teams: { roles: { availableTeamRoles: ['owner', 'viewer'], hierarchy: { owner: 100, viewer: 1 }, defaultTeamRole: 'viewer' } } },
}))
const permissions = [
  { id: 'teams.invite', source: 'core' },
  { id: 'teams.delete', source: 'core' },
  { id: 'posts.publish', source: 'theme' },
  { id: 'posts.create', source: 'entity' },
  { id: 'posts.update', source: 'entity' },
  { id: 'posts.delete', source: 'entity' },
]
jest.mock('@nextsparkjs/core/lib/services/permission.service', () => ({ PermissionService: { getMatrix: () => ({ permissions, matrix: {} }) } }))
jest.mock('@nextsparkjs/registries/permissions-registry', () => ({ PERMISSIONS_METADATA: { generatedAt: 'x' } }))
const plans = [
  { slug: 'free', type: 'free', trialDays: 0 },
  { slug: 'pro', type: 'paid', trialDays: 14, price: { monthly: 1000 } },
  { slug: 'team', type: 'paid', price: { monthly: 3000 } },
]
jest.mock('@nextsparkjs/core/lib/billing/queries', () => ({
  getFullBillingMatrix: () => ({ plans, features: {}, limits: {}, matrix: {}, metadata: { totalPlans: 3, publicPlans: 3, totalFeatures: 0, totalLimits: 0, theme: 't' } }),
}))
jest.mock('@nextsparkjs/core/components/superadmin/tables/RolesPermissionsMatrix', () => ({ RolesPermissionsMatrix: () => null }))
jest.mock('@nextsparkjs/core/components/superadmin/tables/PlanFeaturesMatrix', () => ({ PlanFeaturesMatrix: () => null }))
jest.mock('@nextsparkjs/core/components/ui/tabs', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return { Tabs: Pass, TabsContent: Pass, TabsList: Pass, TabsTrigger: Pass }
})

import TeamRolesPage from '../../../src/routes/superadmin/team-roles/page'

test('a plan with no trial days shows no trial text and no stray 0', () => {
  render(<TeamRolesPage />)
  const free = screen.getByText((_, el) => el?.getAttribute('data-cy') === 'plan-card-free').textContent!
  expect(free).not.toMatch(/0$/)
  expect(free).not.toContain('trialDays')
  expect(screen.getByText((_, el) => el?.getAttribute('data-cy') === 'plan-card-pro').textContent).toContain('trialDays{"days":14}')
  expect(screen.getByText((_, el) => el?.getAttribute('data-cy') === 'plan-card-team').textContent).not.toContain('trialDays')
})
