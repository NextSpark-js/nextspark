# Typed Client and Hooks

**Generated from your entities • Types from the entity contract • TanStack Query hooks • One invalidation rule**

---

## Table of Contents

- [Overview](#overview)
- [What Is Generated](#what-is-generated)
- [Using the Client](#using-the-client)
- [Using the Hooks](#using-the-hooks)
- [Child Entities](#child-entities)
- [Invalidation Rules](#invalidation-rules)
- [Types](#types)
- [Bundle Size](#bundle-size)
- [Checking in CI](#checking-in-ci)
- [Limits](#limits)

---

## Overview

`nextspark prepare` generates, for every entity of your project and of the plugins you enable, a typed client and TanStack
Query hooks. There is nothing to declare: the entity definition stays the only source. The types are the ones of the entity's
portable contract (the module `prepare` generates for clients that must not import server code) (`Task`, `CreateTaskInput`, `UpdateTaskInput`), so a field
you rename in the entity is a compile error in every place that still uses the old name.

The transport is the one the dashboard uses (`entityApi` and `fetchWithTeam`): authentication, the team header and the base path
do not change, and a hook you wrote by hand against the same API keeps working.

The files are git-ignored with the rest of `.nextspark/` and regenerated on every `prepare` (and by `nextspark dev` when an entity
changes). Do not edit them.

## What Is Generated

```
.nextspark/registries/entity-client/
  tasks.client.ts   the client of the entity: tasksClient, Task, CreateTaskInput, UpdateTaskInput, TasksListParams
  tasks.hooks.ts    'use client': useTasksList, useTask, useCreateTask, useUpdateTask, useDeleteTask
  index.ts          api: every client by slug (api.tasks, api['blog-posts']), and every entity module re-exported
  hooks.ts          'use client': every hooks module re-exported
```

They are imported through the registries alias:

```ts
import { api, type Task } from '@nextsparkjs/registries/entity-client'
import { useTasksList } from '@nextsparkjs/registries/entity-client/tasks.hooks'
```

The names come from the entity: the plural of the slug for the list hook (`useTasksList`), `names.singular` for everything else
(`useTask`, `useCreateTask`). Two entities that would produce the same name stop `prepare` with `NS_CLIENT_NAME_CLASH` before
anything is written; give one of them a different `names.singular`.

## Using the Client

```ts
import { api } from '@nextsparkjs/registries/entity-client'

const { data, info } = await api.tasks.list({ limit: 20, filters: { status: 'todo', search: 'invoice' } })
const task = await api.tasks.get(id)
const created = await api.tasks.create({ title: 'Write the report' })
await api.tasks.update(created.id, { status: 'done' })
await api.tasks.delete(created.id)
```

`filters` are the query-string filters of the list endpoint, keyed by the fields of the entity (plus `search`, `sortBy` and
`sortOrder`); a key that is not a field is a type error. `list` returns the API envelope (`data`, `info` with the pagination),
`get`, `create` and `update` return the row.

## Using the Hooks

```tsx
'use client'
import { useCreateTask, useTasksList } from '@nextsparkjs/registries/entity-client/tasks.hooks'

export function Tasks() {
  const tasks = useTasksList({ limit: 20 })
  const create = useCreateTask({ onSuccess: () => toast('Created') })

  return (
    <>
      <button onClick={() => create.mutate({ title: 'New task' })}>Add</button>
      <ul>{tasks.data?.data.map(task => <li key={task.id}>{task.title}</li>)}</ul>
    </>
  )
}
```

| Hook | Arguments | Returns |
| --- | --- | --- |
| `use<Plural>List(params?, options?)` | the list parameters; TanStack Query options | the query of `{ data, info }` |
| `use<Entity>(id, options?)` | the id (nothing is requested while it is `undefined`) | the query of the row |
| `useCreate<Entity>(options?)` | | the mutation; call it with the input |
| `useUpdate<Entity>(options?)` | | the mutation; call it with `{ id, data }` |
| `useDelete<Entity>(options?)` | | the mutation; call it with the id |

Queries wait for the active team before they request anything (inside a `TeamProvider`), so a list is never requested without
its team. Query options (`enabled`, `staleTime`, ...) are passed through; the mutations take the usual mutation options
(`onSuccess`, `onError`, ...), which run after the invalidation described below.

## Child Entities

A child entity is a nested directory of its parent, `entities/<parent>/children/<child>/<child>.config.ts`, exporting a `...ChildConfig`
with `table` and `fields`. The API serves the children the entity registry holds under the parent record
(`/api/v1/<slug>/<parentId>/child/<name>`, `name` being the child's registry name: its `table`), and the client is generated for exactly
those. (A `childEntities` block in the parent's config describes the child rows of a create or update payload; the child routes do not
serve it, so it has no client.) In the examples the child's name is `lines`:

```ts
const lines = await api.orders.children.lines.list(orderId)
await api.orders.children.lines.create(orderId, { sku: 'A-1', qty: 2 })
await api.orders.children.lines.update(orderId, lineId, { qty: 3 })
await api.orders.children.lines.delete(orderId, lineId)
```

```tsx
const lines = useOrderLinesList(orderId)
const add = useCreateOrderLine()
add.mutate({ parentId: orderId, data: { sku: 'A-1' } })
// useUpdateOrderLine: { parentId, id, data }, useDeleteOrderLine: { parentId, id }
```

The types of a child are not in the contracts, so the client file declares them from the child's own `fields`, with the same wire
kinds as the contract (`OrderLineRow` is the child fields plus `id`, `parentId`, `createdAt` and `updatedAt`; a number is
`number | string`, as the driver returns it; a kind that is not described is `unknown`, never `any`). A renamed child field is a compile
error too. A child config whose `fields` are not a literal gets no client, and `prepare` says so in a warning. Reading the children needs the parent readable, and changing one is
an update of the parent, like every other child route.

## Invalidation Rules

All queries of an entity live under the key `['entity', slug]`, the prefix the dashboard's own lists use. After the second element
come the active team id and the kind (`list`, `detail`, `children`), so a team switch never shows another team's cached rows.

| Mutation | What it does to the cache |
| --- | --- |
| create | invalidates everything under `['entity', slug]` |
| update | writes the returned row into the item's query, then invalidates everything under `['entity', slug]` |
| delete | removes the item's cached query, then invalidates everything under `['entity', slug]`. A component that still has the item mounted (`useTask(id)`) observes it again and may request it, so unmount it or pass `enabled: false` when you delete |
| a child create, update or delete | invalidates everything under the parent's `['entity', slug]`: the child list, the parent item and the lists |

"Everything" includes the dashboard's lists of the same entity, so a task created from your own screen shows up in the
dashboard without a reload. The mutation settles when the active queries have been refetched, and your `onSuccess` runs after that.
A mutation that fails invalidates nothing. Other entities are never touched; when a mutation of one entity changes another (a
hook that creates rows elsewhere), invalidate that one yourself:

```ts
queryClient.invalidateQueries({ queryKey: api.projects.keys.all })
```

## Types

```ts
import type { Task, CreateTaskInput, UpdateTaskInput } from '@nextsparkjs/registries/entity-client'
```

The types are inferred from the zod schemas of the contract, which are generated from the entity fields, so the client and the
server cannot disagree about a field. `import type` is erased at build time: the contract adds no JavaScript to the client.

## Bundle Size

Nothing in core imports the generated client, so a route that does not use it carries none of it. The per-entity modules
(`tasks.client.ts`, `tasks.hooks.ts`) carry that entity only, plus TanStack Query, which the app already bundles. `index.ts` and
`hooks.ts` import every entity: use them in code that really needs several, and prefer the per-entity modules in routes where
the JavaScript budget matters.

## Checking in CI

`nextspark prepare --check` compares the client file by file with what `prepare` would write now: a missing file, a changed one, a
file that is left over from an entity you removed, and any file in `.nextspark/registries` that the generation does not record,
all fail the check. Run it in CI after installing, like the rest of the generated output.

## Limits

- The client has the five operations for every entity; an entity that disables one in `access.api` answers 405 at run time.
- Only entities that are in the contracts get a client: the project's and the enabled plugins' top-level entities that are enabled and
  have an external API (`access.api` is not `false`). Core's own entities (users, teams, ...) do not.
- Rows returned by a `?child=` list request stay `unknown`, as in the contract.
- The hooks are React Query hooks like any other: with `providers.scope: 'groups'` the route group that uses them needs a `QueryClientProvider` (`GroupProviders` or `DashboardProviders`) above it.
