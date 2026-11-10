/**
 * The sidebar's entity links carry the entity's slug in their data-cy, not the translated plural (#421).
 */
import React from 'react'
import { render } from '@testing-library/react'

jest.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/lib/config/config-client', () => ({ APP_CONFIG_MERGED: {} }))
jest.mock('@/core/lib/permissions/hooks', () => ({ usePermission: () => true }))
jest.mock('@/core/hooks/useEntityText', () => ({
  // the entity as the active locale names it
  useLocalizedEntityConfigs: (entities: any[]) => entities.map((e) => ({ ...e, names: { plural: 'Aufgaben Liste', singular: 'Aufgabe' } })),
}))

import { DynamicNavigation } from '@/core/components/dashboard/navigation/DynamicNavigation'

it('builds the entity link data-cy from the slug, not the translated name', () => {
  const entities = [{ slug: 'tasks', enabled: true, iconName: 'Box', names: { plural: 'Tasks', singular: 'Task' }, ui: { dashboard: { showInMenu: true } } }]
  const { container } = render(<DynamicNavigation entities={entities as any} />)
  const cys = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('data-cy'))
  expect(cys).toContain('nav-link-entity-tasks')
  expect(cys.some((c) => c?.includes('aufgaben'))).toBe(false)
})
