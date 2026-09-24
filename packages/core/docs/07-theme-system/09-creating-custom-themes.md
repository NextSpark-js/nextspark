# Creating Custom Project Templates

> **Registry commands in this guide** run in a generated project, from its root. In the NextSpark monorepo, run `cd apps/dev && node ../../packages/core/scripts/build/registry.mjs` (add `--watch` to watch).

NextSpark themes are install-once project templates. A generated application
never selects among sibling theme directories: its root is the project.

## Customize one project

For application-specific presentation, edit the root-first source directly:

```text
config/theme.config.ts
config/app.config.ts
config/dashboard.config.ts
styles/
components/
blocks/
templates/
public/
```

Then rebuild registries from the directory containing `nextspark.config.ts`:

```bash
pnpm build:registries
```

## Add a reusable catalog template

Framework contributors add templates under:

```text
packages/core/templates/projects/<template-name>/
```

Start from the closest existing template, then keep only project-owned source.
Do not add a nested `contents/` tree or project-selection environment variable.
The CLI copies the payload into a new project once and omits catalog-only files
such as the template's `package.json`, `.npmignore`, and `README.md`.

A template must not place reserved host names at its root: `app/`, `pages/`,
`src/`, `middleware.*`, `proxy.*`, `instrumentation.*`, or `next.config.*`.
Project request behavior belongs in `config/hooks/proxy.ts` and exports
`proxyHook`.

## Tests

Keep retained template tests under `tests/`. Run them only after copying the
payload into a clean temporary project root with its own `nextspark.config.ts`
and a `package.json` that declares `next`.

- Blog keeps its Jest and Cypress suites.
- CRM and productivity keep their Cypress suites.
- Empty CRM/productivity Jest harnesses are retired.

Template tests must not mutate or select `apps/dev`.
