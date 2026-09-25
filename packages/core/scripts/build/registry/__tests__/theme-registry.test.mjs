/**
 * Tests for the theme-registry generators (#207).
 *
 * theme-registry.ts imports each theme's dashboardConfig/appConfig/devConfig
 * alongside its ThemeConfig, all as fields of one static THEME_REGISTRY
 * object literal - importing any part of it pulls in all of it. ThemeProvider
 * is a client component that only ever reads a theme's own ThemeConfig
 * (styles, component overrides), so it must import theme-registry.client.ts
 * instead: a separate module the generator emits with only that field,
 * leaving dashboard/app/dev config - which can be tens of KB of generated
 * navigation/permission/dev-keyring data - out of the client bundle.
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/theme-registry.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { generateDashboardConfigClient, generateDevKeyringClient, generateThemeRegistry, generateThemeRegistryClient } from '../generators/theme-registry.mjs'

function theme(name) {
  return {
    name,
    exportName: `${name}ThemeConfig`,
    configPath: `@/project/config/theme.config`,
    hasComponents: false,
    hasStyles: true,
    hasAssets: false,
    hasMessages: false,
    hasDashboardConfig: true,
    dashboardConfigPath: '@/project/config/dashboard.config',
    dashboardConfigExportName: 'DASHBOARD_CONFIG',
    hasAppConfig: true,
    appConfigPath: '@/project/config/app.config',
    appConfigExportName: 'APP_CONFIG_OVERRIDES',
    hasDevConfig: true,
    devConfigPath: '@/project/config/dev.config',
    devConfigExportName: 'DEV_CONFIG_OVERRIDES',
    entities: [{ name: 'posts' }],
    routeFiles: [{ path: '/api/posts' }],
    plugins: ['langchain'],
  }
}

const themes = [theme('default')]
const config = { outputDir: '/tmp/registries', projectRoot: '/tmp/project' }

test('the client registry imports only the theme config, not dashboard/app/dev config', () => {
  const out = generateThemeRegistryClient(themes, config)

  assert.match(out, /import \{ defaultThemeConfig \} from '@\/project\/config\/theme\.config'/)
  assert.match(out, /export const THEME_REGISTRY: Record<string, ThemeConfig> = \{/)
  assert.match(out, /'default': defaultThemeConfig/)

  assert.doesNotMatch(out, /dashboard\.config/)
  assert.doesNotMatch(out, /app\.config/)
  assert.doesNotMatch(out, /dev\.config/)
  assert.doesNotMatch(out, /DASHBOARD_CONFIG/)
  assert.doesNotMatch(out, /APP_CONFIG_OVERRIDES/)
  assert.doesNotMatch(out, /DEV_CONFIG_OVERRIDES/)
  // Field-shaped, not bare words: the header comment explains in prose why
  // these are absent, and that prose itself contains "entities".
  assert.doesNotMatch(out, /dashboardConfig:/)
  assert.doesNotMatch(out, /appConfig:/)
  assert.doesNotMatch(out, /devConfig:/)
  assert.doesNotMatch(out, /entities:/)
  assert.doesNotMatch(out, /routeFiles:/)
})

test('the server registry still carries dashboard/app/dev config for server-side use', () => {
  const out = generateThemeRegistry(themes, config)

  assert.match(out, /dashboard\.config/)
  assert.match(out, /app\.config/)
  assert.match(out, /dev\.config/)
  assert.match(out, /dashboardConfig: defaultDashboardConfig/)
  assert.match(out, /appConfig: defaultAppConfig/)
  assert.match(out, /devConfig: defaultDevConfig/)
})

test('with no themes, the client registry still exports an empty THEME_REGISTRY', () => {
  const out = generateThemeRegistryClient([], config)

  assert.match(out, /export const THEME_REGISTRY: Record<string, ThemeConfig> = \{/)
  assert.doesNotMatch(out, /import /)
})

test('the DevKeyring input guards the project dev config behind a production-dead branch', () => {
  const out = generateDevKeyringClient(themes, config)

  assert.match(out, /process\.env\.NODE_ENV !== 'production'/)
  assert.match(out, /require\('@\/project\/config\/dev\.config'\)\.DEV_CONFIG_OVERRIDES/)
  assert.match(out, /export const DEV_KEYRING_CONFIG = DEV_CONFIG\?\.devKeyring/)
})

test('the DevKeyring input is self-contained when a project has no dev config', () => {
  const out = generateDevKeyringClient([{ ...theme('default'), hasDevConfig: false }], config)

  assert.doesNotMatch(out, /require\(/)
  assert.match(out, /DEV_KEYRING_CONFIG = DEV_CONFIG\?\.devKeyring/)
})

test('the dashboard client input imports only dashboard.config, not the server registry', () => {
  const out = generateDashboardConfigClient(themes, config)

  assert.match(out, /from '@\/project\/config\/dashboard\.config'/)
  // The explanatory header may name the excluded server registry. Assert on
  // imports so the test verifies the generated module boundary, not prose.
  assert.doesNotMatch(out, /from ['"][^'"]*theme-registry/)
  assert.doesNotMatch(out, /from ['"][^'"]*dev\.config/)
})
