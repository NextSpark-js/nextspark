---
name: create-theme
description: |
  Guide for authoring install-once NextSpark project templates in the core catalog.
  Use this skill when adding or maintaining a project template such as blog, CRM, or productivity.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
version: "3.0"
---

# Create Project Template Skill

NextSpark no longer installs selectable theme packages into a running project.
The project root is the product source, and a template is copied there once by
`create-nextspark-app --template <name>`.

## Locations

- Catalog source: `packages/core/templates/projects/<template-name>/`
- Extracted source: project-root directories such as `blocks/`, `components/`,
  `config/`, `entities/`, `messages/`, `migrations/`, `public/`, `styles/`,
  `templates/`, and `tests/`
- Generated output: `src/app/` and `.nextspark/registries/` (never edit)

Template payloads are not workspace packages and are never synchronized after
extraction. `nextspark.config.ts` may retain `template.name` and
`template.version` as provenance only.

If catalog metadata includes a `package.json`, keep its Next.js compatibility
explicit so validation covers every supported host major:

```json
{
  "peerDependencies": {
    "next": "^15.0.0 || ^16.0.0"
  }
}
```

## Required workflow

1. Choose a lowercase, hyphenated template name.
2. Copy the closest existing catalog template under
   `packages/core/templates/projects/`.
3. Keep only root-first source directories. Do not add `contents/`, a selectable
   theme directory, or an project environment variable.
4. Do not ship project-root reserved names from the payload: `app/`, `pages/`,
   `src/`, `middleware.*`, `proxy.*`, `instrumentation.*`, or `next.config.*`.
   Project request behavior belongs in `config/hooks/proxy.ts` and exports the
   named `proxyHook` function.
5. Keep template-specific Jest/Cypress suites under `tests/`. Suites must run
   from a clean extracted project root, not by selecting the template in
   `apps/dev`.
6. Update the CLI template choices and tests if the catalog name is new.

## Verification

From the repository root:

```bash
# Confirm no legacy selectable-theme paths or environment selector were added.
rg -n 'contents/(themes|plugins)|NEXT_PUBLIC_ACTIVE_THEME' \
  packages/core/templates/projects/<template-name>

# Exercise compiler discovery from a clean extracted project fixture.
node packages/core/scripts/build/registry.mjs --build

# Run any retained template-specific suite from that extracted root.
pnpm exec jest --config tests/jest/jest.config.cjs --watchman=false
pnpm exec cypress run --config-file tests/cypress.config.ts
```

Use `pnpm` only. Do not edit dependency versions or lockfiles while authoring a
template unless that change is separately requested.
