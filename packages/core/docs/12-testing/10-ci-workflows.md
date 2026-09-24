# CI Workflows

## Root-first rule

CI runs each NextSpark project from the directory containing
`nextspark.config.ts`. It does not select a theme through an environment
variable or a theme-path option.

For the repository development project:

```yaml
- name: Build registries
  working-directory: apps/dev
  run: node ../../packages/core/scripts/build/registry.mjs --build

- name: Type-check
  working-directory: apps/dev
  run: pnpm exec tsc --noEmit
```

## Default project suites

The default product suites run against `apps/dev`, which is itself a root-first
project:

```yaml
- name: Core tests
  run: pnpm --filter @nextsparkjs/core exec jest --watchman=false

- name: Project tests
  working-directory: apps/dev
  run: pnpm exec jest --watchman=false
```

Cypress uses the project-root configuration:

```yaml
- name: Cypress
  working-directory: apps/dev
  run: pnpm exec cypress run --config-file tests/cypress.config.ts
```

## Install-once project templates

The `blog`, `crm`, and `productivity` catalog entries live under
`packages/core/templates/projects/`. A retained suite must be tested only after
its payload is copied into a clean temporary project root. It must not run by
switching `apps/dev` to that template.

A CI extraction job should:

1. Create a temporary project root with a minimal `package.json` that declares
   `next` and a `nextspark.config.ts` recording the template provenance.
2. Copy `packages/core/templates/projects/<name>/` into that root while omitting
   catalog-only `package.json`, `.npmignore`, and `README.md` files, matching the
   CLI extraction behavior.
3. Link or install the repository packages with `pnpm`.
4. Build registries from the extracted root.
5. Run the retained suite from `tests/`.

The blog Jest suite is retained. Blog, CRM, and productivity Cypress suites are
retained. Empty CRM/productivity Jest harnesses are intentionally retired.

## Artifacts

Keep Cypress screenshots, videos, and Allure output under the extracted
project's `tests/cypress/` directory. Upload artifacts even when the browser
suite fails.

## Troubleshooting

- **Project not found:** run from the extracted root and ensure
  `nextspark.config.ts` exists.
- **Invalid root:** ensure `package.json` declares `next`.
- **Missing plugin:** copy it to `plugins/<name>/` and list the name in
  `nextspark.config.ts`.
- **Stale output:** rebuild `.nextspark/registries/` and `src/app/`.
