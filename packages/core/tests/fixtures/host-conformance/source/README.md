Synthetic root-first project source (see packages/core/docs/01-fundamentals/07-root-first-source-contract.md):
`templates/` (pages, layouts, metadata routes), `api/` (route handlers), `plugins/<name>/api/`,
`entities/`, `lib/`, `actions/`, `components/`. Imported as `@/*` by both hosts. No business data, no
credentials: the "session" is the literal cookie `fixture-session=fixture-user`.

Route modules use only location-independent specifiers (`@/...`, `@fixture-core/...`,
`@nextsparkjs/registries/...`, packages), because the manual host places a byte-identical copy of each
at its `src/app` path. `page.isr.tsx` / `page.cc.tsx` exist only in the legacy-ISR / Cache Components
host variant (selected through `pageExtensions`).
