# Route JavaScript budget verification

`pnpm test:route-js-budget` validates the verifier against the tracked
`apps-dev-route-js-budget.json`, including malformed captures, prefetch-counter
integrity, and the preserved direct registry causal comparison fixture. The
`Route JavaScript budget verifier` workflow runs this pure Node test gate on
pull requests and pushes to `main`; it deliberately installs no monorepo
dependencies because the test uses only Node built-ins.

It intentionally does not run a real browser measurement in CI: this repository
does not provide a self-contained app, authentication, and browser-capture setup
for a deterministic route measurement. The fixture's dashboard history is
redirected and therefore is not authentication evidence; the test supplies a
clearly synthetic dashboard row only to exercise verifier integrity checks. The
verifier never updates or blesses a budget; a separately captured measurement
must be passed explicitly with
`pnpm verify:route-js-budget --measurement <capture.json> --budget scripts/performance/apps-dev-route-js-budget.json`.

The runtime template scopes that `test:template-route-conformance` used to build and compare are gone
(#203): a generated host writes every template override as a static facade, and
`node scripts/performance/host-conformance.mjs` checks that build-level property (one component per route, no
runtime lookup) against the generated host.

## Starter project per-route JavaScript

`node scripts/performance/starter-route-js.mjs --app <built project>` measures the client JavaScript each route of a
production build loads before any interaction (the root main files plus the chunks of the route's layouts and page, read
from `.next/build-manifest.json` and the route's client reference manifest; gzip, as `next start` serves it) and checks it
against `starter-route-js-budget.json`. No server, browser or session is needed, so dashboard routes are covered too.

The budget is the published 0.1.0-beta.193 starter plus 5% per route (G0 decision 10), rounded up; `reference193GzipBytes`
is the measured value it comes from. Signed-out routes (`public: true`) also fail when a chunk carries a
`dashboardOnlyMarkers` string (the superadmin and devtools sidebars, the dashboard settings helpers, the team switcher).
The `template-build` job of the `Generated projects` workflow packs this repository once and, for each project template
(starter, blog, crm, productivity), creates a project from the tarballs, migrates and builds it against a service
PostgreSQL and serves it; for the starter (`--preset saas --theme starter`) it also runs this check and the security
probes. This repository's own `route-js-budget.yml` only runs the verifiers' tests.

### Re-basing the budget

Measure a published release, not a build of `main`, so the reference does not move with the code it guards:

```bash
mkdir /tmp/ref && cd /tmp/ref
pnpm dlx create-nextspark-app@<version> app --preset saas --theme starter --type web --name app --slug app -y < /dev/null
cd app   # point DATABASE_URL in .env at a scratch PostgreSQL and set NODE_ENV="production"
pnpm db:migrate
NEXTSPARK_AUTH_RUNTIME_ONLY=email,google pnpm build      # Cache Components on, Turbopack, Next 16.3.5
node <repo>/scripts/performance/starter-route-js.mjs --app . --json measured.json
```

Then set each route's `reference<version>GzipBytes` to `gzipBytes` from `measured.json` and `maxGzipBytes` to
`ceil(reference * 1.05)`; `starter-route-js.test.mjs` fails if a ceiling is not between the reference and +5%. The numbers
are the gzip bytes of what the route's HTML loads, which is not the browser-measured "transferred kB" of the LCP
reference environment: the two are never compared. The 0.1.0-beta.193 values were measured on 2026-10-05 (Node 24.21, macOS
arm64); the build is deterministic, a rebuild of `main` the same day differed by 0.1 kB on one route.

`starter-route-js.test.mjs`
covers the verifier itself.
