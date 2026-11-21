/**
 * The permissions matrix of /superadmin/team-roles: a description under each key, a search over key, label and
 * description, and a "differences only" switch that hides the rows every role agrees on (#535).
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string, values?: Record<string, unknown>) => (values ? `${key}${JSON.stringify(values)}` : key), { has: () => false }),
}))

import { RolesPermissionsMatrix, filterMatrixPermissions } from '../../../src/components/superadmin/tables/RolesPermissionsMatrix'

const data = [
  { id: 'teams.invite', label: 'Invite members', description: 'Can send invitations to new team members', category: 'Team' },
  { id: 'teams.delete', label: 'Delete team', description: 'Can delete the entire team', category: 'Team', dangerous: true },
  { id: 'posts.read', label: 'Read posts', description: 'See every post', category: 'Posts' },
]
const roles = ['owner', 'viewer']
const rolePermissions = { owner: ['teams.invite', 'teams.delete', 'posts.read'], viewer: ['posts.read'] }
const all = data.map(p => p.id)

describe('filterMatrixPermissions', () => {
  it('matches the key, the label and the description, ignoring case', () => {
    expect(filterMatrixPermissions(all, data, roles, rolePermissions, 'POSTS', false)).toEqual(['posts.read'])
    expect(filterMatrixPermissions(all, data, roles, rolePermissions, 'invitations', false)).toEqual(['teams.invite'])
    expect(filterMatrixPermissions(all, data, roles, rolePermissions, 'delete', false)).toEqual(['teams.delete'])
    expect(filterMatrixPermissions(all, data, roles, rolePermissions, '  ', false)).toEqual(all)
  })

  it('keeps only the permissions some roles have and others do not', () => {
    expect(filterMatrixPermissions(all, data, roles, rolePermissions, '', true)).toEqual(['teams.invite', 'teams.delete'])
  })
})

it('shows the description and filters rows from the toolbar', () => {
  render(<RolesPermissionsMatrix roles={roles} hierarchy={{ owner: 100, viewer: 1 }} permissions={rolePermissions} allPermissions={all} permissionsData={data} />)
  expect(screen.getByText('Can delete the entire team')).toBeInTheDocument()
  expect(screen.getByText('showing{"shown":3,"total":3}')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('switch'))
  expect(screen.queryByText('See every post')).not.toBeInTheDocument()
  expect(screen.getByText('showing{"shown":2,"total":3}')).toBeInTheDocument()

  fireEvent.change(screen.getByPlaceholderText('searchPlaceholder'), { target: { value: 'zzz' } })
  expect(screen.getByText('noMatches')).toBeInTheDocument()
})
