/**
 * Client-safe application configuration.
 *
 * Do not import config-sync from a client component. config-sync is the
 * server loader and imports the full theme registry (including dashboard and
 * development configuration). This module has the same public application
 * values needed by client UI, backed only by app-config.client.
 */

import { APP_CONFIG_OVERRIDES } from '@nextsparkjs/registries/app-config.client'
import { DASHBOARD_CONFIG_OVERRIDES } from '@nextsparkjs/registries/dashboard-config.client'
import { DEFAULT_APP_CONFIG } from './app.config'
import { DEFAULT_DASHBOARD_CONFIG } from './dashboard.config'
import { mergeConfigs } from '../utils/config-merge'
import { mergeRolesConfig } from './roles-merge'
import { resolveAuthMethods } from '../auth/auth-methods'
import { resolveOtpConfig } from '../auth/otp-config'
import {
  AVAILABLE_ROLES as REGISTRY_AVAILABLE_ROLES,
  ROLE_HIERARCHY as REGISTRY_ROLE_HIERARCHY,
  ROLE_DISPLAY_NAMES as REGISTRY_ROLE_DISPLAY_NAMES,
  ROLE_DESCRIPTIONS as REGISTRY_ROLE_DESCRIPTIONS,
  DEFAULT_TEAM_ROLE as REGISTRY_DEFAULT_TEAM_ROLE,
} from '@nextsparkjs/registries/permissions-registry'

const mergedConfig = mergeConfigs(DEFAULT_APP_CONFIG, APP_CONFIG_OVERRIDES)

if (APP_CONFIG_OVERRIDES.userRoles) {
  mergedConfig.userRoles = mergeRolesConfig(
    DEFAULT_APP_CONFIG.userRoles,
    APP_CONFIG_OVERRIDES.userRoles,
  )
}

if (DEFAULT_APP_CONFIG.teams?.roles) {
  mergedConfig.teams = {
    ...mergedConfig.teams,
    roles: {
      coreTeamRoles: DEFAULT_APP_CONFIG.teams.roles.coreTeamRoles,
      availableTeamRoles: REGISTRY_AVAILABLE_ROLES as readonly string[],
      defaultTeamRole: REGISTRY_DEFAULT_TEAM_ROLE,
      hierarchy: REGISTRY_ROLE_HIERARCHY,
      displayNames: REGISTRY_ROLE_DISPLAY_NAMES,
      descriptions: REGISTRY_ROLE_DESCRIPTIONS,
    },
  }
}

export const APP_CONFIG_MERGED = mergedConfig
export const I18N_CONFIG = APP_CONFIG_MERGED.i18n
export const APP_NAME = APP_CONFIG_MERGED.app.name
export const APP_VERSION = APP_CONFIG_MERGED.app.version
export const AUTH_CONFIG = APP_CONFIG_MERGED.auth
export const API_CONFIG = APP_CONFIG_MERGED.api
export const TEAMS_CONFIG = APP_CONFIG_MERGED.teams
export const MOBILE_NAV_CONFIG = APP_CONFIG_MERGED.mobileNav

// Dashboard UI configuration is likewise client-safe: it comes from its own
// generated input, never from config-sync's full server theme registry.
export const DASHBOARD_CONFIG = mergeConfigs(DEFAULT_DASHBOARD_CONFIG, DASHBOARD_CONFIG_OVERRIDES)
export const TOPBAR_CONFIG = DASHBOARD_CONFIG.topbar
export const SETTINGS_CONFIG = DASHBOARD_CONFIG.settings

export const isSettingsPageEnabled = (pageName: string): boolean =>
  DASHBOARD_CONFIG.isSettingsPageEnabled(pageName)

export interface EnabledSettingsPage {
  key: string
  order: number
  label: string
}

export const getEnabledSettingsPages = (): EnabledSettingsPage[] =>
  DASHBOARD_CONFIG.getEnabledSettingsPages()

export const isTopbarFeatureEnabled = (feature: string): boolean =>
  DASHBOARD_CONFIG.isTopbarFeatureEnabled(feature)

export const getTopbarFeatureConfig = <T = Record<string, unknown>>(feature: string): T | undefined =>
  (DASHBOARD_CONFIG.topbar as Record<string, unknown>)[feature] as T | undefined

const methods = resolveAuthMethods(APP_CONFIG_MERGED.auth)
export const PUBLIC_AUTH_CONFIG = {
  registration: { mode: APP_CONFIG_MERGED.auth?.registration?.mode ?? 'open' },
  providers: {
    google: {
      enabled: APP_CONFIG_MERGED.auth?.providers?.google?.enabled !== false && methods.includes('google'),
    },
  },
  methods,
  otp: resolveOtpConfig(APP_CONFIG_MERGED.auth),
}
