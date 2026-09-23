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

`pnpm test:template-route-conformance` is the slower, explicit build-level
check for core route template overrides. It creates a synthetic app under
`.e2e/`, builds the beta.191-shaped global-registry baseline, the pre-direct
one-entry scoped shape, the generated direct-scope shape, and a dynamic-family
scope beside a look-alike literal route, then compares their per-entry chunk counts in
Next's build manifests, and removes the fixture afterward. Next 16.3.5 writes
the App Router client graph to per-entry
`page_client-reference-manifest.js` files rather than the former aggregate
`.next/app-build-manifest.json`, so the check counts each entry's unique
reachable client chunks there. It is kept out of the normal unit suite because
it performs four production Next builds.
