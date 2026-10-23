/**
 * The client-safe application configuration that public and auth pages read (the app name, the docs settings, the
 * public auth settings), with the same values as ./config-client.
 *
 * ./config-client also merges the dashboard configuration and the team roles of the permissions registry: a client
 * component on a public or auth route imports this module instead, so those pages ship neither (#207).
 */

import { APP_CONFIG_OVERRIDES } from '@nextsparkjs/registries/app-config.client'
import { PROVIDERS_SCOPE } from '@nextsparkjs/registries/providers-scope'
import { DEFAULT_APP_CONFIG } from './app.config'
import { mergeConfigs } from '../utils/config-merge'
import { resolveAuthMethods } from '../auth/auth-methods'
import { resolveOtpConfig } from '../auth/otp-config'
import { resolveConsentConfig } from '../consent/cookie'

const appConfig = mergeConfigs(DEFAULT_APP_CONFIG, APP_CONFIG_OVERRIDES)

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || appConfig.app.name
export const APP_DESCRIPTION = appConfig.app.description
export const DOCS_CONFIG = appConfig.docs

/** `dashboard` of app.config, read by the sign-in flows for the landing route (`homeRoute`). */
export const DASHBOARD_HOME_CONFIG = appConfig.dashboard

/** Cookie consent (#272), defaults filled in. `enabled` is false unless app.config turns it on. */
export const CONSENT_CONFIG = resolveConsentConfig(appConfig.consent)

/** Whether the root layout mounts the React Query provider and the toaster (`providers.scope`, `'root'` unless app.config says `'groups'`; read when the registries are generated). */
export const ROOT_PROVIDERS = PROVIDERS_SCOPE !== 'groups'

// The registry reads only the literal `providers: { scope: '…' }` of app.config as text; a scope written another way (a spread,
// a variable, quoted keys) is root there while the merged config says otherwise
if (process.env.NODE_ENV !== 'production' && (appConfig.providers?.scope === 'groups') !== (PROVIDERS_SCOPE === 'groups')) {
  console.warn(`[nextspark] providers.scope is '${appConfig.providers?.scope}' in the merged config but the generated registry has '${PROVIDERS_SCOPE}': write it as the literal \`providers: { scope: '…' }\` in config/app.config.ts and regenerate the registries.`)
}

const methods = resolveAuthMethods(appConfig.auth)
export const PUBLIC_AUTH_CONFIG = {
  registration: { mode: appConfig.auth?.registration?.mode ?? 'open' },
  providers: {
    google: {
      enabled: appConfig.auth?.providers?.google?.enabled !== false && methods.includes('google'),
    },
  },
  methods,
  otp: resolveOtpConfig(appConfig.auth),
}
