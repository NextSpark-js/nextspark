# @project/contracts

The portable API contracts of this repository: DTO types and zod schemas for the entities of `apps/dev`,
and the API response envelopes. Everything under `src/` is **generated** by `nextspark prepare` (run from
`apps/dev`) and checked by `nextspark prepare --check`; edit the entity configs, not these files.

- imports `zod` and nothing else: no Node built-ins, no server code, no registries, so `apps/mobile` can use it;
- `package.json` declares which project feeds it (`nextspark.contractsProject`), which is what lets prepare write here;
- `apps/mobile` may import this package and the portable `@nextsparkjs/mobile` / `@nextsparkjs/ui` entries, never
  `@nextsparkjs/core`, `apps/dev`, the db or the registries (`pnpm mobile:boundary` fails when it does).

How it is generated and where it goes: `packages/core/scripts/build/registry/contracts/README.md`.
