/**
 * The core routes that the `features` flags of nextspark.config.ts leave out (#425)
 *
 * A flag set to `false` removes core's contributions for it from the generated host: `nextspark prepare` (and
 * `prepare --check`, which plans the same way) leaves the matching core routes out of the plan, the registries leave
 * them out of the API route list, and the generated `features` registry tells the UI, so it links to none of them
 * (src/lib/config/feature-pages.ts holds the matching page URLs).
 *
 * - `billing: false`: the payment routes go: checkout, portal, change-plan and cancel, the provider webhooks, the
 *   lifecycle cron (trial expiry, past-due grace, the monthly usage reset), the team invoices API and the billing,
 *   plans and invoices settings pages. What a project that uses plans as plain tiers reads stays: the plans list,
 *   `check-action`, the team's subscription and usage, and the superadmin subscriptions page; so do the billing config,
 *   its migrations and its tables.
 *
 * Routes a project or plugin provides itself at those paths are not touched.
 *
 * @module core/scripts/build/registry/host/features
 */

export const FEATURE_DIAGNOSTICS = Object.freeze({
  /** `billing.webhookExtensions` names modules for webhook routes that `billing: false` leaves out */
  BILLING_WEBHOOK_EXTENSIONS: 'NS_HOST_BILLING_OFF_WEBHOOK_EXTENSIONS',
})

/** The core route targets (paths under src/app) each flag leaves out when false. */
export const OMITTED_CORE_ROUTES = Object.freeze({
  billing: [
    /^api\/v1\/billing\/(checkout|portal|change-plan|cancel|webhooks)\//,
    /^api\/cron\/billing\//,
    /^api\/v1\/teams\/\[teamId\]\/invoices\//,
    /^dashboard\/settings\/(billing|plans|invoices)\//,
  ],
})

/** The flag (set to false in `features`) that leaves out the core route at `target`, or null. */
export function omittingFeature(target, features = {}) {
  for (const [flag, patterns] of Object.entries(OMITTED_CORE_ROUTES)) {
    if (features[flag] === false && patterns.some(pattern => pattern.test(target))) return flag
  }
  return null
}

/** The core routes the features keep. */
export function servedCoreRoutes(routes, features = {}) {
  return routes.filter(route => !omittingFeature(route.target, features))
}

/** Settings of nextspark.config.ts that ask for something a flag turned off: each one stops prepare. */
export function featureConfigDiagnostics(config = {}) {
  const extensions = Object.keys(config.billing?.webhookExtensions ?? {})
  if (config.features?.billing !== false || extensions.length === 0) return []
  return [{
    code: FEATURE_DIAGNOSTICS.BILLING_WEBHOOK_EXTENSIONS,
    message:
      `nextspark.config.ts sets features.billing to false, which leaves out the billing webhook routes, but billing.webhookExtensions ` +
      `still names modules for them (${extensions.join(', ')}): remove billing.webhookExtensions, or turn billing back on`,
  }]
}
