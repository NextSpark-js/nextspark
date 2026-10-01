/**
 * The client-safe i18n configuration alone (`I18N_CONFIG` of ./config-client, same value).
 *
 * The root layout's client components (locale cookie, account preference sync) render on every route,
 * public ones included, and only need these values: importing ./config-client there would ship the dashboard,
 * permissions, roles and auth configuration to every page (#207).
 */

import { APP_CONFIG_OVERRIDES } from '@nextsparkjs/registries/app-config.client'
import { DEFAULT_I18N_CONFIG } from './i18n.defaults'
import { mergeConfigs } from '../utils/config-merge'

export const I18N_CONFIG = mergeConfigs(DEFAULT_I18N_CONFIG, APP_CONFIG_OVERRIDES.i18n)
