# Portable contracts

`nextspark prepare` generates a module of **API contracts** from the project's entities (#203, stage 7b): the
TypeScript DTO types and the zod schemas of every entity, and the API response envelopes. A client that must not
import server code - the mobile app - imports it instead of writing the same types by hand.

```ts
import { Task, CreateTaskInput, createTaskInputSchema, apiListResponseSchema, tasksApiPath } from '@project/contracts'
```

The module imports `zod` and nothing else: no Node built-ins, no server code, no registries. It is a pure function of
the entity configs, byte for byte (no timestamps), and is covered by `nextspark prepare --check`.

## What is generated

```
src/index.ts             export * of the envelope, the shared field schemas and the entities
src/envelope.ts          ApiSuccessResponse / ApiListResponse / ApiErrorResponse and their zod schemas
src/fields.ts            re-exports of the schemas several field types share (address, uploaded file, media reference)
src/schema/*.ts          core's portable schema sources, copied verbatim (lib/entities/portable/)
src/entities/index.ts    export * of every entity
src/entities/<slug>.ts   per entity: the entity descriptor, <slug>ApiPath, <Entity> + schema, Create<Entity>Input + schema,
                         Update<Entity>Input + schema, and one enum (schema + type) per select / multiselect field with options
contracts.generation.json   the ownership record: sha256 of every generated file
```

## One source with the server

The contracts are never a second implementation of what the API accepts or returns:

- **Requests are the server's schemas.** `packages/core/src/lib/entities/portable/` holds the code that decides what an entity API
  accepts: `schema-generator.ts` (`generateEntitySchemas` and every field validator - builder `blocks` and `settings`, the PATCH
  preprocessing that drops system and read-only keys, nullable and numeric-string normalization, defaults, `.strict()`), plus what it
  imports. The server re-exports it (`lib/entities/schema-generator.ts`); prepare copies those files **verbatim** into
  `src/schema/`, and each entity module calls `generateEntitySchemas` on a literal descriptor of the entity. A client validates with the
  bytes the server enforces with. (`createTaskInputSchema` is typed `z.ZodType<CreateTaskInput>`: the types say what a client should send,
  the schema also accepts what the server normalizes.)
- **Responses are what the handlers select.** `portable/response-shape.ts` describes the row: `entityResponseSystemColumns` (id, `userId`
  always, `teamId`, timestamps, `blocks` for builder entities, `deletedAt`/`deletedBy` where soft delete is on), `taxonomyResponseFields`
  (each an array of `taxonomyTermSchema`), and the `metas` / `children` expansions. `generic-handler.ts` builds its SELECT lists from
  those functions and prepare evaluates the same module while rendering the DTOs.
- **Wire types follow the driver.** The API returns raw `pg` rows, and `pg` returns NUMERIC/DECIMAL/BIGINT/MONEY as strings unless a type
  parser is configured (none is; a test fails if one appears). The column type is read from the entity's migrations
  (`CREATE TABLE "<slug>"`, `ALTER TABLE ... ADD/ALTER COLUMN`; `pgWireKind` maps it): NUMERIC is `string`, INT/FLOAT `number`, a column
  no migration declares `number | string`.

Tests that pin this: `packages/core/tests/jest/lib/entities/contracts-parity.test.ts` (for every payload the contract accepts exactly
when `generateEntitySchemas` does, on the real apps/dev entities; the copies are byte-identical), and
`packages/core/tests/jest/api/entity/contracts-response-shape.test.ts` (the real handlers, DB mocked: the SELECT columns equal the DTO's,
the response parses through the contract without losing a key).

Other rules:

- the **response** is `id`, `userId`, `teamId`, timestamps, `blocks`, the fields, the taxonomy fields, then the optional `metas` and
  `children`. A field that is `required` or has a `defaultValue` is present; every other field is `nullish`;
- field types map to what the server accepts and stores: text-like types and dates are `string` (ISO for dates), `select`-like types
  with options are an enum, `multiselect` an array of the enum, `tags` an array of strings, `doublerange` a pair of numbers, `address`,
  `file`/`video`/`audio`/`image` and `media-library` use the shared schemas, `relation-multi` sends an array (the response may carry the
  JSON string the server stores), `json` and anything unknown are `unknown`;
- a field's custom `validation` schema is not part of the contract (the server's generator does not use it either);
- `childEntities` ARE part of the contract: they are serialized into the entity descriptor (table and fields, through imports and
  spreads), so the copied generator adds the same `children` to the request schemas as on the server, and the input types type each child
  row from the child's own fields (required unless it has a default, enum options, numbers as a number or a numeric string, an optional
  `id`). A `childEntities` that cannot be described exactly (spread in, computed, a non-literal field) fails generation with a diagnostic
  instead of publishing a schema that contradicts the server's. The rows a `?child=` request returns stay `unknown` in the response.

Entities in the contracts: the project's and its enabled plugins' top-level entities that have an external API
(`access.api` is not `false`) and are enabled. Core's own entities (users, teams, ...) and entities that are nested children of another entity (`entity.parent`) are not entries of their own.

## The wire envelope

`createApiResponse` puts the pagination in `info`, next to the timestamp, and there is no `meta`:

```json
{ "success": true, "data": [ ... ], "info": { "timestamp": "...", "page": 1, "limit": 20, "total": 3, "totalPages": 1, "hasNextPage": false, "hasPrevPage": false } }
```

`ApiListResponse<T>` is exactly that. `@nextsparkjs/mobile`'s client uses the same shapes (`PaginatedResponse<T>` is `ApiListResponse<T>`,
`SingleResponse<T>` is `ApiSuccessResponse<T>`; the old `meta` never existed on the wire), and a test in apps/mobile keeps its types and
the generated ones mutually assignable.

## Where it goes

| Project | Location | In git? |
| --- | --- | --- |
| web-only | `<project>/.nextspark/contracts` | no (`.nextspark/` is ignored; regenerated with the host) |
| web+mobile monorepo (`create-nextspark-app --type web-mobile`) | `packages/contracts`, beside `web/` and `mobile/` | **yes**: mobile builds from it without running the web project |
| this repository | `packages/contracts`, fed by `apps/dev` | **yes** |

A contracts package opts in to being written, and names the project that feeds it, in its `package.json`:

```json
{ "name": "@project/contracts", "nextspark": { "contractsProject": "../web" } }
```

The path is relative to the package and must lead back to the project being prepared. Prepare looks for the package at
`<project>/../packages/contracts`, `<project>/../../packages/contracts` and `<project>/packages/contracts`, and falls back to
`.nextspark/contracts`. The scaffold writes the `package.json`, `tsconfig.json` and README; `src/` is generated.

## Ownership

Like `src/app`, only files NextSpark wrote are ever replaced or deleted: a file is ours when `contracts.generation.json` lists it and
its bytes still have the recorded hash. A file at a target path that is not ours (a hand-written `src/index.ts`, a generated file
edited by hand) stops the run **before anything is written** (in a full prepare, before the host is published either). Files in `src/`
the record does not list are left alone; a generated file no entity produces any more is deleted. Nothing is written through a symlink.

## Commands

- `nextspark prepare` - the generated host writes the contracts with `src/app` and the registries (one lock, one preflight); a project
  whose `src/app` is a committed tree is not prepared at all (`nextspark migrate` first), contracts included;
- `nextspark prepare --contracts-only [--check]` - only the contracts, without touching `src/app`; it refuses a committed `src/app` the same way;
- `nextspark prepare --check` - includes the contracts when the host generates them;
- this repository: `pnpm contracts:generate`, `pnpm contracts:check` (run in the Mobile workflow), `pnpm mobile:boundary`.

## What is not readable

Entity configs are parsed, never executed. `fields` may be an inline array, a `const` in the same file, an import from a relative
module, and spreads of those. A `fields` that is computed, a field whose `name` is not a literal, an `options` list that is not
literal: each becomes a `// Warning:` line in the entity module and a line printed by prepare, and the value is typed `string` or
`unknown` - never left out silently.
