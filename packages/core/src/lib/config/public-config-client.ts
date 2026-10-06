/**
 * The client-safe application configuration that public and auth pages read (the app name, the docs settings, the
 * public auth settings), with the same values as ./config-client.
 *
 * ./config-client also merges the dashboard configuration and the team roles of the permissions registry: a client
 * component on a public or auth route imports this module instead, so those pages ship neither (#207).
 */

import { APP_CONFIG_OVERRIDES } from '@nextsparkjs/registries/app-config.client'
import { DEFAULT_APP_CONFIG } from './app.config'
import { mergeConfigs } from '../utils/config-merge'
import { resolveAuthMethods } from '../auth/auth-methods'
import { resolveOtpConfig } from '../auth/otp-config'

const appConfig = mergeConfigs(DEFAULT_APP_CONFIG, APP_CONFIG_OVERRIDES)

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || appConfig.app.name
export const APP_DESCRIPTION = appConfig.app.description
export const DOCS_CONFIG = appConfig.docs

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
