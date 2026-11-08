/**
 * Render the typed entity client and its TanStack Query hooks (#277), as TypeScript sources.
 *
 * Nothing here is a second description of an entity: the types are the contract's (`Task`, `CreateTaskInput`,
 * `UpdateTaskInput`, imported with `import type`, so the client adds no runtime code from them), and what a
 * client does is core's `createEntityClient` / `useEntityList` / ... (`lib/api/entity-client`, `hooks/entity-client`).
 * A generated file only names those for one entity. It is a pure function of the contracts, byte for byte.
 *
 * ```
 * entity-client/<slug>.ts         the client of the entity (and one per child entity), its types and list params
 * entity-client/<slug>.hooks.ts   'use client': useTasksList, useTask, useCreateTask, useUpdateTask, useDeleteTask (+ child hooks)
 * entity-client/index.ts          `api`: every client by slug, and every entity module re-exported
 * entity-client/hooks.ts          'use client': every hooks module re-exported
 * ```
 *
 * A route that imports `<slug>.ts` or `<slug>.hooks.ts` carries that entity only; `index.ts` and `hooks.ts`
 * carry every entity, which is what a convenience import costs.
 *
 * @module core/scripts/build/registry/client/render
 */

import { CONTRACTS_HEADER, entityNames, pascal, singularize } from '../contracts/render.mjs'

export const CLIENT_DIR = '.nextspark/registries/entity-client'

const CLIENT_MODULE = '@nextsparkjs/core/lib/api/entity-client'
const HOOKS_MODULE = '@nextsparkjs/core/hooks/entity-client'

const quote = value => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const camel = text => {
  const value = pascal(text)
  return value[0].toLowerCase() + value.slice(1)
}
const key = name => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : quote(name))

/** The names a client of this contract declares: types, clients and hooks. */
export function clientNames(contract) {
  const names = entityNames(contract)
  const plural = pascal(contract.slug)
  const children = Object.keys(contract.childEntities ?? {}).map(child => {
    const base = `${names.base}${pascal(singularize(child))}`
    const listed = `${names.base}${pascal(child)}`
    return {
      child,
      row: `${base}Row`,
      create: `Create${base}Input`,
      update: `Update${base}Input`,
      client: `${camel(listed)}Client`,
      hooks: { list: `use${listed}List`, create: `useCreate${base}`, update: `useUpdate${base}`, delete: `useDelete${base}` },
    }
  })
  return {
    names,
    client: `${camel(plural)}Client`,
    listParams: `${plural}ListParams`,
    hooks: { list: `use${plural}List`, item: `use${names.base}`, create: `useCreate${names.base}`, update: `useUpdate${names.base}`, delete: `useDelete${names.base}` },
    children,
  }
}

/** Every name the modules of this entity export, to catch two entities that would export the same one. */
export function clientExportedNames(contract) {
  const { names, client, listParams, hooks, children } = clientNames(contract)
  return [
    client, listParams, names.base, names.create, names.update, ...Object.values(hooks),
    ...children.flatMap(child => [child.row, child.create, child.update, child.client, ...Object.values(child.hooks)]),
  ]
}

function renderClientModule(contract, { source, contractsDir }) {
  const { names, client, listParams, children } = clientNames(contract)
  const lines = [CONTRACTS_HEADER]
  if (source) lines.push(`// Source: ${source}`)
  lines.push('')
  const runtime = children.length > 0
    ? ['createEntityChildClient', 'createEntityClient', 'type EntityChildColumns', 'type EntityClientListParams']
    : ['createEntityClient', 'type EntityClientListParams']
  lines.push(`import { ${runtime.join(', ')} } from ${quote(CLIENT_MODULE)}`)
  lines.push(`import type { ${names.base}, ${names.create}, ${names.update} } from ${quote(`${contractsDir}/entities/${contract.slug}`)}`, '')
  lines.push(`export type { ${names.base}, ${names.create}, ${names.update} }`, '')
  lines.push('/** The parameters of a list: paging, and filters keyed by the fields of the entity. */', `export type ${listParams} = EntityClientListParams<${names.base}>`, '')
  lines.push(`/** \`api/v1/${contract.slug}\`: list, get, create, update, delete. */`, `export const ${client} = createEntityClient<${names.base}, ${names.create}, ${names.update}>(${quote(contract.slug)})`)
  for (const child of children) {
    // The child row types come from the parent's own contract, so a renamed child field is a compile error here too
    const input = `NonNullable<NonNullable<${names.create}['children']>[${quote(child.child)}]>[number]`
    lines.push('', `/** A row of \`${child.child}\` as it is sent: the fields of the child entity. */`, `export type ${child.create} = Omit<${input}, 'id'>`, `export type ${child.update} = Partial<${child.create}>`)
    lines.push(`/** A row of \`${child.child}\` as it is returned. */`, `export type ${child.row} = ${input} & EntityChildColumns`)
    lines.push(`/** \`api/v1/${contract.slug}/<id>/child/${child.child}\`: list, create, update, delete. */`, `export const ${child.client} = createEntityChildClient<${child.row}, ${child.create}, ${child.update}>(${quote(contract.slug)}, ${quote(child.child)})`)
  }
  return `${lines.join('\n')}\n`
}

function renderHooksModule(contract, { source }) {
  const { names, client, listParams, hooks, children } = clientNames(contract)
  const core = ['useEntityCreate', 'useEntityDelete', 'useEntityItem', 'useEntityList', 'useEntityUpdate']
  if (children.length > 0) core.push('useEntityChildCreate', 'useEntityChildDelete', 'useEntityChildList', 'useEntityChildUpdate')
  core.sort()
  const localTypes = [names.base, names.create, names.update, listParams, ...children.flatMap(child => [child.row, child.create, child.update])]
  const localValues = [client, ...children.map(child => child.client)]
  const lines = ["'use client'", '', CONTRACTS_HEADER]
  if (source) lines.push(`// Source: ${source}`)
  lines.push('')
  lines.push(`import { ${core.join(', ')}, type EntityMutationOptions, type EntityQueryOptions } from ${quote(HOOKS_MODULE)}`)
  lines.push(`import type { EntityListResult } from ${quote(CLIENT_MODULE)}`)
  lines.push(`import { ${localValues.join(', ')}, type ${localTypes.join(', type ')} } from ${quote(`./${contract.slug}`)}`, '')
  lines.push(`export const ${hooks.list} = (params?: ${listParams}, options?: EntityQueryOptions<EntityListResult<${names.base}>>) => useEntityList(${client}, params, options)`)
  lines.push(`export const ${hooks.item} = (id: string | undefined, options?: EntityQueryOptions<${names.base}>) => useEntityItem(${client}, id, options)`)
  lines.push(`export const ${hooks.create} = (options?: EntityMutationOptions<${names.base}, ${names.create}>) => useEntityCreate(${client}, options)`)
  lines.push(`export const ${hooks.update} = (options?: EntityMutationOptions<${names.base}, { id: string; data: ${names.update} }>) => useEntityUpdate(${client}, options)`)
  lines.push(`export const ${hooks.delete} = (options?: EntityMutationOptions<{ deleted: boolean; id: string }, string>) => useEntityDelete(${client}, options)`)
  for (const child of children) {
    lines.push('')
    lines.push(`export const ${child.hooks.list} = (parentId: string | undefined, options?: EntityQueryOptions<${child.row}[]>) => useEntityChildList(${child.client}, parentId, options)`)
    lines.push(`export const ${child.hooks.create} = (options?: EntityMutationOptions<${child.row}, { parentId: string; data: ${child.create} }>) => useEntityChildCreate(${child.client}, options)`)
    lines.push(`export const ${child.hooks.update} = (options?: EntityMutationOptions<${child.row}, { parentId: string; id: string; data: ${child.update} }>) => useEntityChildUpdate(${child.client}, options)`)
    lines.push(`export const ${child.hooks.delete} = (options?: EntityMutationOptions<{ id: string }, { parentId: string; id: string }>) => useEntityChildDelete(${child.client}, options)`)
  }
  return `${lines.join('\n')}\n`
}

function renderIndex(entities) {
  const lines = [CONTRACTS_HEADER, '']
  if (entities.length === 0) return `${lines.join('\n')}export const api = {} as const\n`
  for (const { contract } of entities) {
    const { client, children } = clientNames(contract)
    lines.push(`import { ${[client, ...children.map(child => child.client)].join(', ')} } from ${quote(`./${contract.slug}`)}`)
  }
  lines.push('', '/** Every entity client by slug; the child entities of an entity are under `children`. */', 'export const api = {')
  for (const { contract } of entities) {
    const { client, children } = clientNames(contract)
    lines.push(children.length > 0
      ? `  ${key(contract.slug)}: { ...${client}, children: { ${children.map(child => `${key(child.child)}: ${child.client}`).join(', ')} } },`
      : `  ${key(contract.slug)}: ${client},`)
  }
  lines.push('} as const', '')
  for (const { contract } of entities) lines.push(`export * from ${quote(`./${contract.slug}`)}`)
  return `${lines.join('\n')}\n`
}

/**
 * The files of the client for these entity contracts (`{ contract, source }`, slug order), as `{ path, content, grammar }`
 * with `path` relative to the project (under `.nextspark/registries`). `contractsDir` is the module path of the
 * contracts' `src` directory as seen from `entity-client/` (`../../contracts/src`).
 */
export function renderClient(unsorted, { contractsDir }) {
  const entities = [...unsorted].sort((a, b) => (a.contract.slug < b.contract.slug ? -1 : a.contract.slug > b.contract.slug ? 1 : 0))
  const hooks = entities.length > 0 ? entities.map(({ contract }) => `export * from ${quote(`./${contract.slug}.hooks`)}`).join('\n') : 'export {}'
  const files = [
    { path: `${CLIENT_DIR}/index.ts`, content: renderIndex(entities) },
    { path: `${CLIENT_DIR}/hooks.ts`, content: `'use client'\n\n${CONTRACTS_HEADER}\n\n${hooks}\n` },
  ]
  for (const { contract, source } of entities) {
    files.push({ path: `${CLIENT_DIR}/${contract.slug}.ts`, content: renderClientModule(contract, { source, contractsDir }) })
    files.push({ path: `${CLIENT_DIR}/${contract.slug}.hooks.ts`, content: renderHooksModule(contract, { source }) })
  }
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)).map(file => ({ ...file, grammar: null }))
}
