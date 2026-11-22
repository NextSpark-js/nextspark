# CI Workflows

## Root-first rule

CI runs each NextSpark project from the directory containing
`nextspark.config.ts`. It does not select a theme through an environment
variable or a theme-path option.

For the repository development project:

```yaml
- name: Build registries
  working-directory: apps/dev
  run: node ../../packages/cli/dist/cli.js prepare

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

## What this repository's CI runs

The snippets above are shapes for a project's pipeline. The framework repository's own workflows are in
`.github/workflows`. The ones that run core's suites:

| Workflow, job | Runs | Node | When |
| --- | --- | --- | --- |
| `checks.yml`, `jest-core` | `pnpm --filter @nextsparkjs/core test` (Jest) | 22.14.0 and 24 | Push to `main`; pull requests to `main` that touch `apps/`, `packages/`, `plugins/`, `scripts/` or the root configuration |
| `tests.yml`, `test` with suite `core` | `pnpm exec tsx --test packages/core/tests/node/*.test.ts` (`node:test`) | 22.14.0 and 24 | Push to `main`; every pull request to `main` |

**The PostgreSQL suites run in both.** The suites that start a throwaway cluster skip themselves when the
PostgreSQL binaries are not on the `PATH` (see
[Integration Testing](./07-integration-testing.md#what-it-needs-on-the-path)), and they are not on the `PATH` of
the `ubuntu-24.04` image. Both steps therefore add the image's PostgreSQL 16 directory, and fail when it is gone:

```yaml
run: |
  test -x /usr/lib/postgresql/16/bin/initdb || { echo "::error::PostgreSQL 16 binaries not found at /usr/lib/postgresql/16/bin"; exit 1; }
  PATH="$PATH:/usr/lib/postgresql/16/bin" pnpm exec tsx --test packages/core/tests/node/*.test.ts
```

So in CI:

- `tests/node/oauth-connections-pg.test.ts` (the rules MCP browser sign-in keeps in the database) and
  `tests/node/mcp-oauth-sign-in.test.ts` run in the `core` suite of `tests.yml`, against PostgreSQL 16, on both
  Node versions;
- the Jest suites that use a cluster (`*.pg.test.ts` and the others that import the same helper) run in
  `jest-core`;
- `tests/jest/lib/api/credential-rate-limit.test.ts` runs in `jest-core`, with the shared store mocked.

What CI does not do:

- The guard checks for `initdb` only. `HAS_POSTGRES` also needs `postgres`, which is in the same directory on
  Ubuntu's server package. If an image ever shipped `initdb` and `pg_ctl` there without the server, the suites
  would skip and the step would still pass: read the `skipped` count of the run when the image changes.
- No job runs the suites against PostgreSQL 15, 17 or 18. Other workflows run the migrations on those versions
  (`theme-migrations.yml`, the `migrate` job of `generated-projects.yml`), not these tests.
- No job runs against a real Redis. The procedure in
  [Verifying the shared rate limit with Redis](./12-shared-rate-limit-verification.md) is run by a person.
- No job connects a real MCP client (Claude, ChatGPT) to a deployment.

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
