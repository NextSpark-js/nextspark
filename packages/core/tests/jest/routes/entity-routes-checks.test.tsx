/**
 * The generated host's per-entity routes (#203, stage 4): core's checks run BEFORE any project template. A
 * disabled or hidden entity answers notFound() whatever templates the project has; the create and edit routes
 * keep the generated factory when a template exists (the template is an argument, never a replacement).
 */
import React from 'react'

const notFound = jest.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})
const redirect = jest.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})
jest.mock('next/navigation', () => ({ notFound: () => notFound(), redirect: (url: string) => redirect(url), useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@nextsparkjs/core/components/entities/wrappers/EntityListWrapper', () => ({ EntityListWrapper: () => null }))
jest.mock('@nextsparkjs/core/components/entities/wrappers/EntityDetailWrapper', () => ({ EntityDetailWrapper: () => null }))
jest.mock('../../../src/routes/_internal/entity-create-view', () => ({ EntityCreateView: () => null }))
jest.mock('../../../src/routes/_internal/entity-edit-view', () => ({ EntityEditView: () => null }))

import { createEntityListRoute } from '../../../src/routes/_internal/entity-list-route'
import { createEntityDetailRoute } from '../../../src/routes/_internal/entity-detail-route'
import { createEntityCreateRoute } from '../../../src/routes/_internal/entity-create-route'
import { createEntityEditRoute } from '../../../src/routes/_internal/entity-edit-route'
import type { EntityConfig } from '../../../src/lib/entities/types'

const config = (extra: Record<string, unknown> = {}) =>
  ({ slug: 'tasks', enabled: true, ui: { dashboard: { showInMenu: true } }, ...extra }) as unknown as EntityConfig
const DISABLED = config({ enabled: false })
const HIDDEN = config({ ui: { dashboard: { showInMenu: false } } })
const params = Promise.resolve({ id: '7' })

const Template = () => null
type Element = React.ReactElement<{ params: Promise<Record<string, string>> }>

beforeEach(() => {
  notFound.mockClear()
  redirect.mockClear()
})

describe.each([
  ['list', (c: EntityConfig) => createEntityListRoute(c, Template as never)],
  ['detail', (c: EntityConfig) => createEntityDetailRoute(c, [], Template as never)],
  ['create', (c: EntityConfig) => createEntityCreateRoute(c, Template as never)],
  ['edit', (c: EntityConfig) => createEntityEditRoute(c, Template as never)],
])('%s route with a project template', (_name, make) => {
  it.each([['disabled', DISABLED], ['hidden from the dashboard', HIDDEN]])('answers notFound() for an entity that is %s, without reaching the template', async (_label, entity) => {
    const route = make(entity) as unknown as (props: { params: Promise<{ id: string }> }) => Promise<unknown>
    await expect(route({ params })).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalledTimes(1)
  })

  it('renders the template for a served entity, with the route params it always got', async () => {
    const route = make(config()) as unknown as (props: { params: Promise<{ id: string }> }) => Promise<Element>
    const element = await route({ params })
    expect(element.type).toBe(Template)
    expect(notFound).not.toHaveBeenCalled()
    await expect(element.props.params).resolves.toMatchObject({ entity: 'tasks' })
  })
})

describe('what each route renders without a template', () => {
  const run = async (route: unknown, props: Record<string, unknown> = { params }) => (route as (p: unknown) => Promise<Element>)(props)

  it('create and edit render the generated view, so a project template cannot discard the factory', async () => {
    const create = await run(createEntityCreateRoute(config()))
    expect((create.type as { name?: string }).name).toBe('EntityCreateView')
    expect(create.props).toMatchObject({ entity: 'tasks' })
    const edit = await run(createEntityEditRoute(config()))
    expect(edit.props).toMatchObject({ entity: 'tasks', id: '7' })
  })

  it('detail redirects builder entities to edit only after the checks, and the template still wins over the redirect', async () => {
    const builder = config({ builder: { enabled: true } })
    await expect(run(createEntityDetailRoute(builder, []))).rejects.toThrow('NEXT_REDIRECT:/dashboard/tasks/7/edit')
    const element = await run(createEntityDetailRoute(builder, [], Template as never))
    expect(element.type).toBe(Template)
    await expect(run(createEntityDetailRoute(config({ enabled: false, builder: { enabled: true } }), []))).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('create and edit are served when the flag is absent (the client registry\'s `!== false`), list and detail need it set (theirs is truthy)', async () => {
    const bare = { slug: 'tasks' } as unknown as EntityConfig
    await expect(run(createEntityCreateRoute(bare, Template as never))).resolves.toBeTruthy()
    await expect(run(createEntityEditRoute(bare, Template as never))).resolves.toBeTruthy()
    await expect(run(createEntityListRoute(bare, Template as never))).rejects.toThrow('NEXT_NOT_FOUND')
    await expect(run(createEntityDetailRoute(bare, [], Template as never))).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
