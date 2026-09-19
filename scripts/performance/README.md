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
