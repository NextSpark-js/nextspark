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

The budget is the 0.1.0-beta.191 starter-equivalent project (`create-nextspark-app --preset saas --theme default`, the
published packages) measured by the same script, plus 2%. Signed-out routes (`public: true`) also fail when a chunk carries a
`dashboardOnlyMarkers` string (the superadmin and devtools sidebars, the dashboard settings helpers, the team switcher).
The `starter-route-js` job of the `Route JavaScript budget verifier` workflow packs this repository, creates the starter
(`--preset saas --theme starter`), builds it against a service PostgreSQL and runs the check; `starter-route-js.test.mjs`
covers the verifier itself.
