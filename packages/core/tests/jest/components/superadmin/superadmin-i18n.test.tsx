/**
 * @jest-environment jsdom
 *
 * #412: the sidebars, the teams table and the pagination of the superadmin area show the texts of the active locale
 * (here Spanish and German), with dates and numbers in its format, and the pieces that render with no provider stay English.
 */
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

let mockLocale = 'es'

// next-intl as the real core catalog of the active locale answers it (ICU plurals included, through the shared mock)
jest.mock('next-intl', () => {
  const actual = jest.requireActual('../../__mocks__/next-intl-server.js') as {
    format: (template: string, params: unknown, locale: string) => string
  }
  const catalog = (): Record<string, unknown> => require(`../../../../src/messages/${mockLocale}/index`).default
  const read = (namespace: string, key: string) =>
    `${namespace}.${key}`.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), catalog())
  return {
    useLocale: () => mockLocale,
    useMessages: () => catalog(),
    useTranslations: (namespace: string) => {
      const t = (key: string, params?: unknown) => {
        const value = read(namespace, key)
        if (typeof value !== 'string') throw new Error(`missing ${namespace}.${key}`)
        return actual.format(value, params, mockLocale)
      }
      t.has = (key: string) => typeof read(namespace, key) === 'string'
      return t
    },
  }
})
jest.mock('next/navigation', () => ({ usePathname: () => '/superadmin/users', useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@nextsparkjs/registries/plugin-registry.client', () => ({ getPluginNavItems: () => [] }))
jest.mock('@tanstack/react-query', () => ({ useMutation: () => ({ isPending: false, mutate: jest.fn() }), useQueryClient: () => ({ invalidateQueries: jest.fn() }) }))
jest.mock('@nextsparkjs/core/lib/auth-client', () => ({ useSession: () => ({ data: { user: { id: 'viewer', role: 'developer' } } }) }))
jest.mock('@nextsparkjs/core/hooks/useToast', () => ({ useToast: () => ({ toast: jest.fn() }) }))
jest.mock('@nextsparkjs/core/lib/role-helpers', () => ({ useRoleTranslations: () => (role: string) => role }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...rest }: React.ComponentProps<'a'>) => <a href={href as string} {...rest}>{children}</a> }))

import { SuperadminSidebar } from '@/core/components/superadmin/layouts/SuperadminSidebar'
import { SuperadminDocsSidebar } from '@/core/components/docs/superadmin-docs-sidebar'
import { TeamsTable } from '@/core/components/superadmin/tables/TeamsTable'
import { RolesPermissionsMatrix } from '@/core/components/superadmin/tables/RolesPermissionsMatrix'
import { UsersTable } from '@/core/components/users/tables/UsersTable'
import { SuperAdminsTable } from '@/core/components/users/tables/SuperAdminsTable'
import { PaginationControls } from '@/core/components/superadmin/filters/PaginationControls'
import { SearchInput } from '@/core/components/superadmin/filters/SearchInput'
import { formatLocaleDate, formatLocaleNumber } from '@/core/lib/i18n/format'
import es from '@/core/messages/es/index'
import de from '@/core/messages/de/index'

afterEach(() => {
  cleanup()
  mockLocale = 'es'
})

const team = { id: 'team-0123456789abcdef', name: 'Acme Labs', owner: { id: 'u1', name: 'Ana', email: 'ana@acme.test' }, memberCount: 3, createdAt: '2024-03-05T12:00:00Z', updatedAt: '2024-03-05T12:00:00Z' }

describe('SuperadminSidebar', () => {
  test('shows its texts in Spanish, and the toggle and the exit link are named in Spanish', () => {
    render(<SuperadminSidebar pluginItems={[]} />)
    expect(screen.getByText(es.superadmin.sidebar.items.teams.title)).toBeInTheDocument()
    expect(screen.getByText(es.superadmin.sidebar.items.teams.description)).toBeInTheDocument()
    expect(screen.getByText(es.superadmin.sidebar.restricted.title)).toBeInTheDocument()
    expect(screen.getByLabelText(es.superadmin.sidebar.exit.label)).toBeInTheDocument()
    expect(screen.getByLabelText(es.superadmin.sidebar.collapse)).toBeInTheDocument()
    expect(screen.queryByText('Exit Super Admin')).toBeNull()
    expect(screen.queryByLabelText('Collapse sidebar')).toBeNull()
  })

  test('the collapsed sidebar names the toggle for expanding and the disabled sections for what they are', () => {
    render(<SuperadminSidebar pluginItems={[]} />)
    fireEvent.click(screen.getByLabelText(es.superadmin.sidebar.collapse))
    expect(screen.getByLabelText(es.superadmin.sidebar.expand)).toBeInTheDocument()
    const disabled = document.querySelector(`[title="${es.superadmin.sidebar.comingSoonTitle.replace('{title}', es.superadmin.sidebar.items.analytics.title)}"]`)
    expect(disabled).not.toBeNull()
  })

  test('follows the locale: German', () => {
    mockLocale = 'de'
    render(<SuperadminSidebar pluginItems={[]} />)
    expect(screen.getByLabelText(de.superadmin.sidebar.exit.label)).toBeInTheDocument()
    expect(screen.getByText(de.superadmin.sidebar.items.users.title)).toBeInTheDocument()
  })
})

describe('SuperadminDocsSidebar', () => {
  test('names its navigation and its heading in Spanish', () => {
    render(<SuperadminDocsSidebar sections={[]} />)
    expect(screen.getByLabelText(es.superadmin.docs.navigation)).toBeInTheDocument()
    expect(screen.getByText(es.superadmin.docs.sidebarTitle)).toBeInTheDocument()
    expect(screen.queryByText('Admin Docs')).toBeNull()
  })
})

describe('TeamsTable', () => {
  test('has its columns, the plural of its members and its date in Spanish', () => {
    render(<TeamsTable teams={[team]} />)
    for (const heading of Object.values(es.superadmin.teamsTable.columns)) expect(screen.getAllByText(heading).length).toBeGreaterThan(0)
    expect(screen.getByText('miembros')).toBeInTheDocument()
    expect(screen.getByText(formatLocaleDate(team.createdAt, 'es'))).toBeInTheDocument()
    expect(formatLocaleDate(team.createdAt, 'es')).toMatch(/mar/i)
    expect(screen.queryByText('members')).toBeNull()
  })

  test('says member in the singular and shows the empty state in the locale', () => {
    const { rerender } = render(<TeamsTable teams={[{ ...team, memberCount: 1 }]} />)
    expect(screen.getByText('miembro')).toBeInTheDocument()
    rerender(<TeamsTable teams={[]} />)
    expect(screen.getByText(es.superadmin.teamsTable.empty.title)).toBeInTheDocument()
  })
})

describe('RolesPermissionsMatrix', () => {
  test('names the roles in the headers with the team roles of the locale, and a role the catalog does not know as it comes', () => {
    render(<RolesPermissionsMatrix roles={['owner', 'auditor']} hierarchy={{ owner: 100, auditor: 5 }} permissions={{ owner: ['a.b'], auditor: [] }} allPermissions={['a.b']} />)
    expect(screen.getByText('Propietario')).toBeInTheDocument()
    expect(screen.getByText('auditor')).toBeInTheDocument()
    expect(screen.getByText(es.superadmin.rolesMatrix.permission)).toBeInTheDocument()
    expect(screen.queryByText('owner')).toBeNull()
  })
})

describe('the users tables', () => {
  const user = { id: 'user-0123456789', fullName: 'Luz Perez', email: 'luz@acme.test', role: 'member', emailVerified: false, createdAt: '2024-03-05T12:00:00Z' }

  test('UsersTable has its columns, status and date in Spanish', () => {
    render(<UsersTable users={[user as never]} />)
    for (const key of ['user', 'email', 'role', 'status', 'joined', 'actions'] as const) expect(screen.getAllByText(es.superadmin.users.table[key]).length).toBeGreaterThan(0)
    expect(screen.getByText(es.superadmin.users.table.pending)).toBeInTheDocument()
    expect(screen.getByText(formatLocaleDate(user.createdAt, 'es'))).toBeInTheDocument()
    expect(screen.queryByText('Joined')).toBeNull()
    expect(screen.queryByText('Unknown')).toBeNull()
  })

  test('SuperAdminsTable has its columns, status, date and notice in Spanish', () => {
    render(<SuperAdminsTable superadmins={[{ ...user, role: 'superadmin' } as never]} currentUserId="viewer" />)
    for (const key of ['administrator', 'since', 'unverified'] as const) expect(screen.getAllByText(es.superadmin.users.table[key]).length).toBeGreaterThan(0)
    expect(screen.getByText(formatLocaleDate(user.createdAt, 'es'))).toBeInTheDocument()
    expect(screen.getByText(es.superadmin.users.security.notice)).toBeInTheDocument()
    expect(screen.queryByText('Since')).toBeNull()
  })
})

describe('PaginationControls and SearchInput', () => {
  test('show their texts, their numbers in bold, in the locale', () => {
    render(<PaginationControls page={2} totalPages={5} total={50} limit={10} onPageChange={() => {}} onLimitChange={() => {}} context="users" />)
    expect(screen.getByText(es.superadmin.pagination.rowsPerPage)).toBeInTheDocument()
    expect(screen.getByText('Página 2 de 5')).toBeInTheDocument()
    expect(screen.getByText('11').className).toContain('font-medium')
    expect(screen.getByText('20').className).toContain('font-medium')
    expect(screen.getByText('50').className).toContain('font-medium')
    expect(document.body.textContent).toContain('Mostrando 11 a 20 de 50 resultados')
  })

  test('the search placeholder is the locale\'s unless the page passes its own', () => {
    render(<><SearchInput value="" onChange={() => {}} /><SearchInput value="" onChange={() => {}} placeholder="Mine" /></>)
    expect(screen.getByPlaceholderText(es.superadmin.filters.searchPlaceholder)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Mine')).toBeInTheDocument()
  })
})

test('numbers follow the locale', () => {
  expect(formatLocaleNumber(1234567, 'de')).toBe('1.234.567')
  expect(formatLocaleNumber(1234567, 'en')).toBe('1,234,567')
})
