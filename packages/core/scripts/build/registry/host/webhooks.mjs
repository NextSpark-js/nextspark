/**
 * Billing webhook extensions of the generated host (#203)
 *
 * A project that handles one-time payments (credit packs, upsells) extends core's billing webhooks with a module
 * of its own. It declares the module in nextspark.config.ts:
 *
 * ```ts
 * export default defineConfig({
 *   billing: {
 *     webhookExtensions: {
 *       stripe: './lib/billing/stripe-webhook-extensions', // exports `stripeWebhookExtensions`
 *       polar: './lib/billing/polar-webhook-extensions',   // exports `polarWebhookExtensions`
 *     },
 *   },
 * })
 * ```
 *
 * The host then replaces core's webhook route with a composed facade that statically imports that module and hands
 * it to core's handler (`createStripeWebhookRoute` / `createPolarWebhookRoute`). Nothing is loaded by a path chosen at
 * runtime, and a project without the setting keeps core's route (no extensions).
 *
 * @module core/scripts/build/registry/host/webhooks
 */

import { existsSync, statSync } from 'node:fs'
import { isAbsolute, join, posix, relative, sep } from 'node:path'

import { CORE_ROUTES_SPECIFIER } from './core-routes.mjs'

export const WEBHOOK_DIAGNOSTICS = Object.freeze({
  INVALID: 'NS_HOST_WEBHOOK_EXTENSIONS_INVALID',
  MISSING: 'NS_HOST_WEBHOOK_EXTENSIONS_MISSING',
})

const BILLING_WEBHOOKS_MODULE = `${CORE_ROUTES_SPECIFIER}_internal/billing-webhooks`

/** The webhook providers the host can extend: core route, the wrapper it composes and the export it needs. */
export const WEBHOOK_PROVIDERS = Object.freeze({
  stripe: { target: 'api/v1/billing/webhooks/stripe/route.ts', wrapper: 'createStripeWebhookRoute', exportName: 'stripeWebhookExtensions' },
  polar: { target: 'api/v1/billing/webhooks/polar/route.ts', wrapper: 'createPolarWebhookRoute', exportName: 'polarWebhookExtensions' },
})

const EXTENSIONS = ['ts', 'tsx', 'mts', 'js', 'jsx', 'mjs']

/**
 * The composed webhook routes for `billing.webhookExtensions`.
 *
 * @param {object} input
 * @param {Record<string, string>|undefined} input.webhookExtensions - the config value: provider -> module path, from the project root
 * @param {string} input.projectRoot
 * @param {(specifier: string) => string|null} input.resolveFile - core module specifier -> file
 * @returns {{ routes: Record<string, object>, diagnostics: object[] }} routes by target, for `planHost({ webhooks })`
 */
export function webhookRoutes({ webhookExtensions, projectRoot, resolveFile }) {
  const routes = {}
  const diagnostics = []
  for (const [provider, value] of Object.entries(webhookExtensions ?? {})) {
    const spec = WEBHOOK_PROVIDERS[provider]
    const where = `nextspark.config.ts billing.webhookExtensions.${provider}`
    if (!spec) {
      diagnostics.push({ code: WEBHOOK_DIAGNOSTICS.INVALID, message: `${where}: "${provider}" is not a webhook provider (expected ${Object.keys(WEBHOOK_PROVIDERS).join(', ')})` })
      continue
    }
    if (typeof value !== 'string' || value.trim() === '') {
      diagnostics.push({ code: WEBHOOK_DIAGNOSTICS.INVALID, message: `${where} must be the path of a module from the project root, such as "./lib/billing/${provider}-webhook-extensions"` })
      continue
    }
    const path = value.trim().replace(/\\/g, '/')
    const absolute = isAbsolute(path) ? path : join(projectRoot, path)
    const inside = relative(projectRoot, absolute).split(sep)
    if (isAbsolute(path) || inside[0] === '..' || inside.includes('..') || inside[0] === 'node_modules') {
      diagnostics.push({ code: WEBHOOK_DIAGNOSTICS.INVALID, message: `${where} (${JSON.stringify(value)}) must stay inside the project and not point into node_modules` })
      continue
    }
    const withoutExtension = absolute.replace(new RegExp(`\\.(${EXTENSIONS.join('|')})$`), '')
    const file = [absolute, ...EXTENSIONS.map(extension => `${withoutExtension}.${extension}`)].find(candidate => existsSync(candidate) && statSync(candidate).isFile())
    if (!file) {
      diagnostics.push({ code: WEBHOOK_DIAGNOSTICS.MISSING, message: `${where}: no module found at ${JSON.stringify(value)} (tried ${EXTENSIONS.map(extension => `.${extension}`).join(', ')})` })
      continue
    }
    const specifier = `@/${posix.normalize(relative(projectRoot, withoutExtension).split(sep).join('/'))}`
    routes[spec.target] = {
      provider,
      source: `${where} (${value})`,
      specifier,
      file,
      extensionsSpecifier: specifier,
      exportName: spec.exportName,
      wrapper: { name: spec.wrapper, specifier: BILLING_WEBHOOKS_MODULE, file: resolveFile(BILLING_WEBHOOKS_MODULE) },
    }
  }
  return { routes, diagnostics }
}
