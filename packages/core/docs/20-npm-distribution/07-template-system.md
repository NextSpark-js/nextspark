# Template System

> **Registry commands in this guide** run in a generated project, from its root. In the NextSpark monorepo, run `cd apps/dev && node ../../packages/core/scripts/build/registry.mjs` (add `--watch` to watch).

NextSpark has two different template layers:

1. **Project templates** under `packages/core/templates/projects/<name>/` are
   install-once source payloads selected by `create-nextspark-app --theme`.
2. **Host templates** under `packages/core/templates/app/` are framework inputs
   used to generate `src/app/`.

## Project-template extraction

The CLI copies the selected project template's root-level source directories
into the new project. Catalog-only `package.json`, `.npmignore`, and `README.md`
files are not copied. The extracted source is immediately owned by the project
and is not synchronized on framework updates.

The CLI writes provenance to `nextspark.config.ts`:

```ts
export default defineConfig({
  template: { name: 'blog', version: '0.1.0-beta.193' },
})
```

That metadata never selects or reloads the catalog payload.

## Host generation

The compiler combines core host templates with project route templates from
root-level `templates/`, diagnoses route collisions, and writes only under:

```text
src/app/
.nextspark/registries/
```

Project templates override replaceable core presentation defaults. Protected
framework routes and invariants cannot be replaced silently.

## Testing catalog templates

Retained template suites run after extraction into a clean temporary project
root. Blog keeps Jest and Cypress; CRM and productivity keep Cypress. Empty
Jest harnesses are retired.

## Troubleshooting

- Confirm `nextspark.config.ts` and `package.json` exist at the extracted root.
- Confirm `package.json` declares `next`.
- Confirm project overrides are under `templates/`, not `src/app/`.
- Rebuild with `pnpm build:registries`.
