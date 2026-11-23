/**
 * @jest-environment jsdom
 *
 * #549: the texts the core itself writes in English (its own permissions and their categories, the developer role) follow
 * the interface language; a permission a project adds, or one whose text a project changed, is shown as written.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

import es from '../../../../src/messages/es/superadmin.json'
import { CORE_PERMISSIONS_CONFIG } from '../../../../src/lib/permissions/system'
import { CORE_PERMISSION_TEXTS } from '../../../../src/components/superadmin/tables/core-permission-texts'

const LANGS = ['en', 'es', 'de', 'fr', 'it', 'pt']
const load = (lang: string, file: string) => require(`../../../../src/messages/${lang}/${file}.json`)

const lookup = (messages: Record<string, unknown>, key: string): unknown =>
  key.split('.').reduce<unknown>((acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined), messages)

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const es = jest.requireActual('../../../../src/messages/es/superadmin.json') as Record<string, Record<string, unknown>>
    const messages = namespace === 'superadmin.rolesMatrix' ? es.rolesMatrix : namespace === 'superadmin.usersPage' ? es.usersPage : {}
    return Object.assign((key: string) => String(lookup(messages, key) ?? key), { has: (key: string) => typeof lookup(messages, key) === 'string' })
  },
}))

// What the configured role name says for the developer: the English of common.userRoles, in every locale
jest.mock('../../../../src/lib/role-helpers', () => ({ useRoleTranslations: () => (role: string) => `configured:${role}` }))

import { UserRoleBadge } from '../../../../src/components/users/tables/UserBadges'
import { RolesPermissionsMatrix } from '../../../../src/components/superadmin/tables/RolesPermissionsMatrix'

const core = CORE_PERMISSIONS_CONFIG.systemPermissions
const data = [
  { ...core[0] },
  { id: 'teams.delete', label: 'Delete team', description: 'A project wrote this one', category: 'Team' },
  { id: 'posts.read', label: 'Read posts', description: 'See every post', category: 'Posts' },
]
const roles = ['owner']
const perms = { owner: data.map(p => p.id) }

describe('the permissions matrix in Spanish', () => {
  test('a core permission is translated, the rest is shown as written', () => {
    render(<RolesPermissionsMatrix roles={roles} hierarchy={{ owner: 100 }} permissions={perms} allPermissions={data.map(p => p.id)} permissionsData={data} />)
    expect(screen.getByText(es.rolesMatrix.corePermissions.teams.invite)).toBeInTheDocument()
    expect(screen.queryByText(core[0].description!)).toBeNull()
    expect(screen.getByText('A project wrote this one')).toBeInTheDocument()
    expect(screen.getByText('See every post')).toBeInTheDocument()
  })

  test('the core category is translated, a project category is not', () => {
    render(<RolesPermissionsMatrix roles={roles} hierarchy={{ owner: 100 }} permissions={perms} allPermissions={data.map(p => p.id)} permissionsData={data} />)
    expect(screen.getByText(es.rolesMatrix.coreCategories.Team)).toBeInTheDocument()
    expect(screen.getByText('Posts')).toBeInTheDocument()
  })
})

describe('the catalogs', () => {
  test('the copy of the core texts equals the core config', () => {
    expect(CORE_PERMISSION_TEXTS).toEqual(Object.fromEntries(core.map(p => [p.id, { description: p.description, category: p.category }])))
  })

  test.each(LANGS)('%s has a description for every core permission and a name for its categories', (lang) => {
    const { rolesMatrix } = load(lang, 'superadmin')
    for (const p of core) {
      expect(typeof lookup(rolesMatrix.corePermissions, p.id)).toBe('string')
      expect(rolesMatrix.coreCategories[p.category]).toBeTruthy()
    }
  })

  test.each(LANGS)('%s names the developer in the users list', (lang) => {
    expect(load(lang, 'superadmin').usersPage.roles.developer).toBeTruthy()
  })
})

describe('the role badge', () => {
  test('uses the name of the role filter, and the configured one for a role the list does not name', () => {
    render(<><UserRoleBadge user={{ role: 'developer' }} /><UserRoleBadge user={{ role: 'admin' as never }} /></>)
    expect(screen.getByText(es.usersPage.roles.developer)).toBeInTheDocument()
    expect(screen.getByText('configured:admin')).toBeInTheDocument()
    expect(screen.queryByText('configured:developer')).toBeNull()
  })
})
