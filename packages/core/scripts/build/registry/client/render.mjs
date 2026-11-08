/**
 * Render the typed entity client and its TanStack Query hooks (#277), as TypeScript sources.
 *
 * Nothing here is a second description of an entity: the types of an entity are the contract's (`Task`, `CreateTaskInput`,
 * `UpdateTaskInput`, imported with `import type`, so the client adds no runtime code from them), and what a client does is
 * core's `createEntityClient` / `useEntityList` / ... (`lib/api/entity-client`, `hooks/entity-client`). A generated file only
 * names those for one entity. It is a pure function of the contracts, byte for byte.
 *
 * ```
 * entity-client/<slug>.client.ts  the client of the entity (and one per child entity), its types and list params
 * entity-client/<slug>.hooks.ts   'use client': useTasksList, useTask, useCreateTask, useUpdateTask, useDeleteTask (+ child hooks)
 * entity-client/index.ts          `api`: every client by slug, and every entity module re-exported
 * entity-client/hooks.ts          'use client': every hooks module re-exported
 * ```
 *
 * A slug cannot contain a dot, so `<slug>.client.ts` and `<slug>.hooks.ts` never meet `index.ts` or `hooks.ts`; core's runtime is
 * imported as a namespace, so no name an entity produces can meet one of its exports.
 *
 * Child entities are the ones the child routes serve: the registry's nested `children/<child>/` entries. Their types are not in
 * the contracts (which describe the `childEntities` of a parent payload), so they are rendered from the child's own fields, with the
 * contract's wire kinds: nothing is `any`, a kind that is not described is `unknown`.
 *
 * @module core/scripts/build/registry/client/render
 */

import { CONTRACTS_HEADER, entityNames, pascal, singularize } from '../contracts/render.mjs'
import { wireKind } from '../contracts/read-entities.mjs'

export const CLIENT_DIR = '.nextspark/registries/entity-client'

const CLIENT_MODULE = '@nextsparkjs/core/lib/api/entity-client'
const HOOKS_MODULE = '@nextsparkjs/core/hooks/entity-client'

/** The columns the child routes own: not part of what a client sends. */
const CHILD_MANAGED = new Set(['id', 'parentId', 'createdAt', 'updatedAt'])

const quote = value => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const camel = text => {
  const value = pascal(text)
  return value[0].toLowerCase() + value.slice(1)
}
const key = name => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : quote(name))
const literal = value => (typeof value === 'number' ? String(value) : quote(value))

/** The names a client of this contract declares: types, clients and hooks. `children` are the child entities of this parent. */
export function clientNames(contract, children = []) {
  const names = entityNames(contract)
  const plural = pascal(contract.slug)
  return {
    names,
    client: `${camel(plural)}Client`,
    listParams: `${plural}ListParams`,
    hooks: { list: `use${plural}List`, item: `use${names.base}`, create: `useCreate${names.base}`, update: `useUpdate${names.base}`, delete: `useDelete${names.base}` },
    children: children.map(child => {
      // `customers_notes` of `customers` is the note of a customer
      const short = child.name.startsWith(`${contract.slug}_`) ? child.name.slice(contract.slug.length + 1) : child.name
      const base = `${names.base}${pascal(singularize(short))}`
      const listed = `${names.base}${pascal(short)}`
      return {
        child: child.name,
        fields: child.fields.filter(field => !CHILD_MANAGED.has(field.name)),
        row: `${base}Row`,
        create: `Create${base}Input`,
        update: `Update${base}Input`,
        client: `${camel(listed)}Client`,
        hooks: { list: `use${listed}List`, create: `useCreate${base}`, update: `useUpdate${base}`, delete: `useDelete${base}` },
      }
    }),
  }
}

/** Every name the modules of this entity export, to catch two entities that would export the same one. */
export function clientExportedNames(contract, children = []) {
  const { names, client, listParams, hooks, children: named } = clientNames(contract, children)
  return [
    client, listParams, names.base, names.create, names.update, ...Object.values(hooks),
    ...named.flatMap(child => [child.row, child.create, child.update, child.client, ...Object.values(child.hooks)]),
  ]
}

/** The TypeScript type of a child field's value; `shared` collects the shared field types it needs. */
function fieldType(field, shared) {
  const wire = wireKind(field)
  switch (wire.kind) {
    case 'string': return 'string'
    case 'number': return 'number | string'
    case 'boolean': return 'boolean'
    case 'tuple': return '[number, number]'
    case 'string-array': return 'string[]'
    case 'id-list': return 'string[] | string'
    case 'enum': return wire.values.map(literal).join(' | ')
    case 'enum-array': return `(${wire.values.map(literal).join(' | ')})[]`
    case 'address': shared.add('Address'); return 'Address'
    case 'media': shared.add('MediaRef'); return 'MediaRef'
    case 'files': shared.add('FileObject'); return 'FileObject[]'
    case 'image': shared.add('FileObject'); return 'string | FileObject[]'
    default: return 'unknown'
  }
}

const members = (fields, shared, { required }) => fields.map(field => {
  const type = fieldType(field, shared)
  return required(field) ? `${key(field.name)}: ${type}` : `${key(field.name)}?: ${type} | null`
}).join('; ')

function renderClientModule(contract, children, { source, contractsDir }) {
  const { names, client, listParams, children: named } = clientNames(contract, children)
  const shared = new Set()
  const types = named.map(child => ({
    child,
    create: members(child.fields, shared, { required: field => field.required && !field.hasDefault }),
    row: members(child.fields, shared, { required: field => field.required }),
  }))
  const lines = [CONTRACTS_HEADER]
  if (source) lines.push(`// Source: ${source}`)
  lines.push('', `import * as runtime from ${quote(CLIENT_MODULE)}`)
  lines.push(`import type { ${names.base}, ${names.create}, ${names.update} } from ${quote(`${contractsDir}/entities/${contract.slug}`)}`)
  if (shared.size > 0) lines.push(`import type { ${[...shared].sort().join(', ')} } from ${quote(`${contractsDir}/fields`)}`)
  lines.push('', `export type { ${names.base}, ${names.create}, ${names.update} }`, '')
  lines.push('/** The parameters of a list: paging, and filters keyed by the fields of the entity. */', `export type ${listParams} = runtime.EntityClientListParams<${names.base}>`, '')
  lines.push(`/** \`api/v1/${contract.slug}\`: list, get, create, update, delete. */`, `export const ${client} = runtime.createEntityClient<${names.base}, ${names.create}, ${names.update}>(${quote(contract.slug)})`)
  for (const { child, create, row } of types) {
    lines.push('', `/** A row of \`${child.child}\` as it is sent: the fields of the child entity. */`, `export type ${child.create} = { ${create} }`, `export type ${child.update} = Partial<${child.create}>`)
    lines.push(`/** A row of \`${child.child}\` as it is returned. */`, `export type ${child.row} = runtime.EntityChildColumns & { ${row} }`)
    lines.push(`/** \`api/v1/${contract.slug}/<id>/child/${child.child}\`: list, create, update, delete. */`, `export const ${child.client} = runtime.createEntityChildClient<${child.row}, ${child.create}, ${child.update}>(${quote(contract.slug)}, ${quote(child.child)})`)
  }
  return `${lines.join('\n')}\n`
}

function renderHooksModule(contract, children, { source }) {
  const { names, client, listParams, hooks, children: named } = clientNames(contract, children)
  const localTypes = [names.base, names.create, names.update, listParams, ...named.flatMap(child => [child.row, child.create, child.update])]
  const localValues = [client, ...named.map(child => child.client)]
  const lines = ["'use client'", '', CONTRACTS_HEADER]
  if (source) lines.push(`// Source: ${source}`)
  lines.push('')
  lines.push(`import * as query from ${quote(HOOKS_MODULE)}`)
  lines.push(`import type * as runtime from ${quote(CLIENT_MODULE)}`)
  lines.push(`import { ${localValues.join(', ')}, type ${localTypes.join(', type ')} } from ${quote(`./${contract.slug}.client`)}`, '')
  lines.push(`export const ${hooks.list} = (params?: ${listParams}, options?: query.EntityQueryOptions<runtime.EntityListResult<${names.base}>>) => query.useEntityList(${client}, params, options)`)
  lines.push(`export const ${hooks.item} = (id: string | undefined, options?: query.EntityQueryOptions<${names.base}>) => query.useEntityItem(${client}, id, options)`)
  lines.push(`export const ${hooks.create} = (options?: query.EntityMutationOptions<${names.base}, ${names.create}>) => query.useEntityCreate(${client}, options)`)
  lines.push(`export const ${hooks.update} = (options?: query.EntityMutationOptions<${names.base}, { id: string; data: ${names.update} }>) => query.useEntityUpdate(${client}, options)`)
  lines.push(`export const ${hooks.delete} = (options?: query.EntityMutationOptions<runtime.EntityDeleteResult, string>) => query.useEntityDelete(${client}, options)`)
  for (const child of named) {
    lines.push('')
    lines.push(`export const ${child.hooks.list} = (parentId: string | undefined, options?: query.EntityQueryOptions<${child.row}[]>) => query.useEntityChildList(${child.client}, parentId, options)`)
    lines.push(`export const ${child.hooks.create} = (options?: query.EntityMutationOptions<${child.row}, { parentId: string; data: ${child.create} }>) => query.useEntityChildCreate(${child.client}, options)`)
    lines.push(`export const ${child.hooks.update} = (options?: query.EntityMutationOptions<${child.row}, { parentId: string; id: string; data: ${child.update} }>) => query.useEntityChildUpdate(${child.client}, options)`)
    lines.push(`export const ${child.hooks.delete} = (options?: query.EntityMutationOptions<runtime.EntityDeleteResult, { parentId: string; id: string }>) => query.useEntityChildDelete(${child.client}, options)`)
  }
  return `${lines.join('\n')}\n`
}

function renderIndex(entities, childrenOf) {
  const lines = [CONTRACTS_HEADER, '']
  if (entities.length === 0) return `${lines.join('\n')}export const api = {} as const\n`
  for (const { contract } of entities) {
    const { client, children } = clientNames(contract, childrenOf(contract))
    lines.push(`import { ${[client, ...children.map(child => child.client)].join(', ')} } from ${quote(`./${contract.slug}.client`)}`)
  }
  lines.push('', '/** Every entity client by slug; the child entities of an entity are under `children`. */', 'export const api = {')
  for (const { contract } of entities) {
    const { client, children } = clientNames(contract, childrenOf(contract))
    lines.push(children.length > 0
      ? `  ${key(contract.slug)}: { ...${client}, children: { ${children.map(child => `${key(child.child)}: ${child.client}`).join(', ')} } },`
      : `  ${key(contract.slug)}: ${client},`)
  }
  lines.push('} as const', '')
  for (const { contract } of entities) lines.push(`export * from ${quote(`./${contract.slug}.client`)}`)
  return `${lines.join('\n')}\n`
}

/**
 * The files of the client for these entity contracts (`{ contract, source }`) and child entities (`{ parent, name, fields, source }`,
 * `parent` being a slug), as `{ path, content, grammar }` with `path` relative to the project (under `.nextspark/registries`).
 * `contractsDir` is the module path of the contracts' `src` directory as seen from `entity-client/` (`../../contracts/src`).
 */
export function renderClient(unsorted, { contractsDir, children = [] }) {
  const entities = [...unsorted].sort((a, b) => (a.contract.slug < b.contract.slug ? -1 : a.contract.slug > b.contract.slug ? 1 : 0))
  const childrenOf = contract => children.filter(child => child.parent === contract.slug).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  const hooks = entities.length > 0 ? entities.map(({ contract }) => `export * from ${quote(`./${contract.slug}.hooks`)}`).join('\n') : 'export {}'
  const files = [
    { path: `${CLIENT_DIR}/index.ts`, content: renderIndex(entities, childrenOf) },
    { path: `${CLIENT_DIR}/hooks.ts`, content: `'use client'\n\n${CONTRACTS_HEADER}\n\n${hooks}\n` },
  ]
  for (const { contract, source } of entities) {
    files.push({ path: `${CLIENT_DIR}/${contract.slug}.client.ts`, content: renderClientModule(contract, childrenOf(contract), { source, contractsDir }) })
    files.push({ path: `${CLIENT_DIR}/${contract.slug}.hooks.ts`, content: renderHooksModule(contract, childrenOf(contract), { source }) })
  }
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)).map(file => ({ ...file, grammar: null }))
}
