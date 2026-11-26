/**
 * An entity list draws its own header (EntityListWrapper passes showHeader={false}); while the rows load, the table
 * must reserve only the table's place. A whole-page skeleton inside the list put a second header, with its own
 * padding, under the real one (#559).
 */
import React from 'react'
import { render } from '@testing-library/react'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/dashboard/pages' }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
jest.mock('@/core/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, isLoading: false }) }))
jest.mock('@/core/hooks/useTeam', () => ({ useTeam: () => ({ teamId: 'team-1', isReady: true }) }))
jest.mock('@/core/lib/permissions/hooks', () => ({ usePermission: () => true }))

import { EntityTable } from '@/core/components/entities/EntityTable'

const CONFIG = {
  slug: 'pages',
  enabled: true,
  names: { singular: 'Page', plural: 'Pages' },
  access: {},
  ui: { dashboard: { filters: [], columns: [] }, features: { bulkOperations: false } },
  fields: [],
} as never

test('loading with showHeader={false} reserves the table only', () => {
  const { container } = render(<EntityTable entityConfig={CONFIG} data={[]} loading showHeader={false} />)
  expect(container.querySelector('table')).not.toBeNull()
  expect(container.querySelector('.mb-8')).toBeNull()
  expect((container.firstElementChild as HTMLElement).className).not.toContain('p-6')
})

test('loading with the default header keeps the whole-page skeleton', () => {
  const { container } = render(<EntityTable entityConfig={CONFIG} data={[]} loading />)
  expect(container.querySelector('.mb-8')).not.toBeNull()
})
