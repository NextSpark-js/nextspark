# Generated-host conformance fixture (#203, stage 1)

Two Next.js hosts built from one synthetic root-first source, to prove that a `src/app` made of
generated facades behaves exactly like a hand-written app.

| Directory | What it is |
| --- | --- |
| `source/` | The root-first project source (`templates/`, `api/`, `plugins/<name>/api/`, `entities/`, `lib/`, `actions/`, `components/`), imported as `@/*`. |
| `fake-core/` | Stand-in for the `@nextsparkjs/core` package (`@fixture-core/*`): core default routes (`routes.mjs`) and their modules. |
| `manual/` | The reference: a hand-written Next.js app whose `src/app` files are the source modules placed at their route (byte-identical; the conformance script checks it) and hand-written registries. |
| `generated/` | `src/app` facades and `.nextspark/registries` written by `generate.mjs` through `packages/core/scripts/build/registry/host/facade-emitter.mjs`. Git-ignored. |
| `plan.mjs` | Route resolution shared by both: core defaults < project `templates/` overrides, plus `api/` and plugin route handlers. |
| `host-config.mjs` | `next.config` of both hosts. `HOST_CACHE_MODE=isr\|cc` switches `cacheComponents`; `HOST_BUNDLER` names the `distDir` (`.next-<bundler>-<mode>`) and the type-check config (`tsconfig.<bundler>-<mode>.json`). |

Routes that only make sense with one cache model are named `page.isr.tsx` / `page.cc.tsx` /
`layout.cc.tsx`; `pageExtensions` picks them per variant, in both hosts alike.

Cases (RFC #203 "First proof"): core page overridden by `templates/about`; protected notes (auth in
`lib/notes-data.ts`, used by the page, `api/notes` and the `addNote` Server Action; the
`(protected)` layout only composes UI; the session is the literal cookie
`fixture-session=fixture-user`); `counter` client page; `posts/[slug]` with `generateStaticParams`
and `generateMetadata`, `aliased/[slug]` exporting it under an alias (`export { listSlugs as generateStaticParams }`),
`items/[id]` calling `notFound()`, `go/[target]` redirecting; `isr`
(`revalidate`) and `legacy-dynamic` vs `cached` / `cached-module` (`'use cache'`, PPR); the `hello`
plugin route handler; `registry` importing the generated server and client-safe registries;
`sitemap.ts`, `icon.tsx` and the numbered metadata variants `icon1.tsx` and `opengraph-image2.tsx`.

Client JS is compared as code and as a module graph (`scripts/performance/host-conformance-bytes.mjs`): every module
gets an identity-preserving canonical label (its body with each referenced module id replaced by the target's label,
iterated to a fixpoint over the host's whole module table), so renumbered ids compare equal while a retargeted
dependency, entry or client reference does not. Only the fixed facade artifacts in
`scripts/performance/host-conformance-expected.json` are cut first; per-route and global chunk sets, bytes and client
references must then match exactly. CSS is compared by content digests per route, per HTML response and globally
(`fake-core/components/shell.css` gives every route a stylesheet).

Run everything (8 production builds, `next start` for each, Markdown report):

```sh
node scripts/performance/host-conformance.mjs --report /tmp/host-conformance.md
```

Or by hand: `node packages/core/tests/fixtures/host-conformance/generate.mjs`, then in `manual/` or
`generated/`: `HOST_CACHE_MODE=cc HOST_BUNDLER=turbopack ../../../../node_modules/.bin/next build --turbopack`.
Next.js, React and TypeScript resolve from `packages/core/node_modules`; the fixture is not a
workspace package.
