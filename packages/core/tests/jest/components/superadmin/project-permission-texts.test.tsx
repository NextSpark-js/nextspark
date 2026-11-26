/**
 * @jest-environment jsdom
 *
 * #553: the texts of the permissions a preset writes (its team block, its features and the entity permissions it generates)
 * follow the interface language in the Team Roles matrix; a literal a project keeps is shown as written.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { localizePermissionTexts, defaultEntityPermissionTexts } from '../../../../src/lib/permissions/permission-texts'
import { RolesPermissionsMatrix } from '../../../../src/components/superadmin/tables/RolesPermissionsMatrix'

jest.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { has: () => false }),
}))

const LANGS = ['en', 'es', 'de', 'fr', 'it', 'pt']
const SRC = join(__dirname, '../../../../src/messages')
const PROJECTS = join(__dirname, '../../../../templates/projects')
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'))

const lookup = (messages: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined), messages)

/** A root translator over a catalog, as `getTranslations()` gives on the server. */
function translator(messages: Record<string, unknown>) {
  const t = (key: string, values?: Record<string, string | number>) => {
    const text = lookup(messages, key)
    if (typeof text !== 'string') throw new Error(`no string at ${key}`)
    return text.replace(/\{(\w+)\}/g, (_, name) => String(values?.[name]))
  }
  return Object.assign(t, { has: (key: string) => lookup(messages, key) !== undefined })
}

const starter = (lang: string) => json(join(PROJECTS, 'starter/messages', lang, 'permissionTexts.json'))
const es = {
  superadmin: json(join(SRC, 'es/superadmin.json')),
  permissionTexts: starter('es'),
  tasks: json(join(PROJECTS, 'starter/entities/tasks/messages/es.json')),
  pages: json(join(PROJECTS, 'starter/entities/pages/messages/es.json')),
}
const tes = translator(es)
const entities = ['tasks', 'pages', 'posts']

const generated = (id: string, category: string) => {
  const defaults = defaultEntityPermissionTexts(id.split('.')[1], category)
  return { id, category, source: 'theme', ...defaults }
}

describe('the texts of the project permissions in Spanish', () => {
  test('a team permission takes its text from the catalog by id', () => {
    const { texts } = localizePermissionTexts(tes, [{ id: 'team.members.invite', label: 'Invite Members', description: 'Can invite new team members', category: 'Teams', source: 'theme' }], { locale: 'es', entities })
    expect(texts['team.members.invite']).toEqual({ label: 'Invitar miembros', description: 'Puede invitar a nuevos miembros del equipo' })
  })

  test('an entity permission without a text is generated from the action and the name of the entity', () => {
    const { texts, categories } = localizePermissionTexts(tes, [generated('tasks.create', 'Tasks'), generated('tasks.assign', 'Tasks')], { locale: 'es', entities })
    expect(texts['tasks.create']).toEqual({ label: 'Crear tareas', description: 'Puede crear tareas' })
    expect(texts['tasks.assign'].description).toBe('Puede asignar tareas a miembros del equipo')
    expect(categories).toEqual({ Tasks: 'Tareas' })
  })

  test('a text that is a message key is translated', () => {
    const t = translator({ ...es, presets: { hello: 'Hola' } })
    const { texts } = localizePermissionTexts(t, [{ id: 'x.y', label: 'presets.hello', description: 'presets.nothing', category: 'X' }], { locale: 'es', entities })
    expect(texts['x.y']).toEqual({ label: 'Hola' })
  })

  test('a literal the catalog does not know, and a text a project wrote for an entity, stay as written', () => {
    const { texts } = localizePermissionTexts(
      tes,
      [{ id: 'custom.thing', label: 'A thing', description: 'Can do a thing.', category: 'Custom' }, { id: 'tasks.create', label: 'Create tasks', description: 'Can create new tasks', category: 'Tasks', source: 'theme' }],
      { locale: 'es', entities },
    )
    expect(texts).toEqual({})
  })

  test('the core permissions are left to the matrix, and an entity without a catalog name keeps its English', () => {
    const { texts, categories } = localizePermissionTexts(tes, [{ ...generated('teams.invite', 'Team'), source: 'core' }, generated('posts.create', 'Posts')], { locale: 'es', entities })
    expect(texts).toEqual({})
    expect(categories).toEqual({})
  })

  test('the categories the generator and a preset use', () => {
    const { categories } = localizePermissionTexts(tes, [
      { id: 'team.view', label: 'View Team', description: 'x', category: 'Teams', source: 'theme' },
      { id: 'a.b', label: 'a', description: 'x', category: 'Features', source: 'theme' },
    ], { locale: 'es', entities })
    expect(categories).toEqual({ Teams: 'Equipos', Features: 'Funciones' })
  })
})

describe('the matrix with those texts', () => {
  const data = [
    { id: 'tasks.create', label: 'Create Tasks', description: 'Can create tasks', category: 'Tasks' },
    { id: 'team.view', label: 'View Team', description: 'Can view team details', category: 'Teams' },
  ]
  const props = { roles: ['owner'], hierarchy: { owner: 100 }, permissions: { owner: ['tasks.create', 'team.view'] }, allPermissions: ['tasks.create', 'team.view'], permissionsData: data }

  test('shows the resolved description and category', () => {
    const permissionTexts = localizePermissionTexts(tes, data.map(p => ({ ...p, source: 'theme' })), { locale: 'es', entities })
    render(<RolesPermissionsMatrix {...props} permissionTexts={permissionTexts} />)
    expect(screen.getByText('Puede crear tareas')).toBeInTheDocument()
    expect(screen.getByText('Puede ver los detalles del equipo')).toBeInTheDocument()
    expect(screen.getByText('Tareas')).toBeInTheDocument()
    expect(screen.queryByText('Can create tasks')).toBeNull()
  })

  test('without them, the text is shown as written', () => {
    render(<RolesPermissionsMatrix {...props} />)
    expect(screen.getByText('Can create tasks')).toBeInTheDocument()
    expect(screen.getByText('Teams')).toBeInTheDocument()
  })
})

describe('the catalogs', () => {
  const ids = (text: string, pattern: RegExp) => [...text.matchAll(pattern)].map(m => m[1])
  const config = (template: string) => readFileSync(join(PROJECTS, template, 'config/permissions.config.ts'), 'utf8')
  const templateMessages = (template: string, lang: string) =>
    template === 'starter' ? { permissionTexts: starter(lang) } : json(join(PROJECTS, template, 'messages', `${lang}.json`))

  test.each(LANGS)('%s names the generated texts and categories in the core catalog', (lang) => {
    const { rolesMatrix } = json(join(SRC, lang, 'superadmin.json'))
    for (const action of ['create', 'read', 'list', 'update', 'delete', 'publish', 'unpublish', 'assign']) {
      for (const field of ['label', 'description']) expect(rolesMatrix.entityActions[action][field]).toContain('{entity}')
    }
    expect(rolesMatrix.generatedCategories.Teams).toBeTruthy()
    expect(rolesMatrix.generatedCategories.Features).toBeTruthy()
  })

  test.each(['starter', 'crm', 'productivity'])('%s: every team and feature permission, and every custom category, has a text in the six languages', (template) => {
    const source = config(template)
    const permissionIds = [...ids(source, /action: '(team\.[\w.]+)'/g), ...ids(source, /action: '([\w]+\.[\w.]+)',\s+label:/g)]
    const categories = ids(source, /category: '([^']+)'/g)
    expect(permissionIds.length).toBeGreaterThan(0)
    for (const lang of LANGS) {
      const { permissionTexts } = templateMessages(template, lang)
      for (const id of permissionIds) {
        expect(typeof lookup(permissionTexts, `${id}.label`)).toBe('string')
        expect(typeof lookup(permissionTexts, `${id}.description`)).toBe('string')
      }
      for (const category of categories.filter(c => c !== 'Leads')) expect(typeof permissionTexts.categories[category]).toBe('string')
    }
  })

  test('the templates give no English text to the standard entity actions, so the generated one is used', () => {
    for (const template of readdirSync(PROJECTS)) {
      const entityLines = config(template).split('\n').filter(line => /^ {6}\{ action: '/.test(line))
      expect(entityLines.length).toBeGreaterThan(0)
      for (const line of entityLines) expect(line).not.toMatch(/label:|description:/)
    }
  })
})
