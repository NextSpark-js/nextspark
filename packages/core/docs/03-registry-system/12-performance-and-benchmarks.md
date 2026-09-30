# Performance Model

**What the registries remove at runtime • Comparison with alternatives • What is and is not measured**

---

## Overview

The registries move work from request time to build time. `nextspark prepare` discovers entities, plugins, themes, templates, translations and config once and writes them as static modules; runtime code reads those modules.

**Mechanism:**
- ✅ No runtime filesystem access or content discovery
- ✅ Keyed lookups on plain objects, not scans
- ✅ Static imports that Turbopack/webpack can trace, split and tree-shake
- ✅ Types generated from the same discovery, so they match what the registries contain

## What is and is not measured

This repository ships **no benchmark** of registry lookups against runtime discovery, so this page gives no speed-up factor, latency or memory figure. Earlier versions of these docs quoted figures that nobody could reproduce; they were removed.

What the repository does measure, with scripts you can run:

- **Route JavaScript budget:** `scripts/performance/verify-route-js-budget.mjs` checks a capture of the route JS the browser loads against `scripts/performance/apps-dev-route-js-budget.json` (see `scripts/performance/README.md`).
- **Generated-host output:** `scripts/performance/host-conformance.mjs` and `host-conformance-bytes.mjs` check that the generated `src/app` stays a set of thin facades with static imports.

To measure the registries in your own project, time `pnpm exec nextspark prepare` (generation cost) and use your build output and browser tooling (runtime cost).

---

## Generation cost and runtime cost

- **Generation** reads every content directory once. It grows with the amount of content and runs in `nextspark prepare`, `nextspark dev` (once at start, then incrementally on change) and `nextspark build`.
- **Runtime** is a property read on a static module. It does not scan directories, so it does not depend on how many files the project has. Only the registry entries a route imports end up in that route's bundle.

---

## Optimization techniques

1. **Keep registries lean.** Put only the metadata that is needed at runtime in them.
2. **Use union types for names.** `type EntityName = 'tasks' | 'users'` is simpler for TypeScript than one type per name.
3. **Lazy-load translations.** Loaders in the translation registry import a locale only when it is requested.

---

## Comparison with alternatives

| | Registry System | Runtime discovery (filesystem) | Dynamic imports | In-memory cache | Database |
|---|---|---|---|---|---|
| **Work at request time** | Property read | Scan, read, process | Module resolution by variable | Populate once, then read | Query |
| **Type safety** | Full (generated) | None | Partial | Depends | Depends |
| **Bundler can trace it** | Yes (static imports) | No | Limited | n/a | n/a |
| **Invalidation** | Not needed (regenerated) | n/a | n/a | Required | n/a |
| **Setup** | Build step | None | None | Cache code | Database |

Runtime resolution by variable is also a product rule: no route's module graph may resolve a module from a variable (lazy loading with a fixed specifier is fine). See [Enforcement and Validation](./11-enforcement-and-validation.md).

---

## When to use the registry system

- ✅ Content that changes with the code (themes, plugins, entities, config)
- ✅ Lookups on every request
- ✅ Type safety matters
- ❌ Data that changes at runtime (user content): use the database
- ❌ Computed values: use a cache
- ❌ Static assets: use a CDN

**Next steps:**
- [Troubleshooting](./13-troubleshooting-and-debugging.md) - Common issues and solutions
- [Introduction](./01-introduction.md) - Registry system overview
- [Build Script](./02-build-registry-script.md) - How registries are generated
