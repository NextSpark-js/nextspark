/**
 * Prompts Index
 *
 * Exports all prompts and provides functions to run prompts in sequence.
 * Supports different modes: interactive (all 8 steps), quick (steps 1-5), expert (all with extra options).
 */

import type { WizardConfig } from '../types.js'
import { promptProjectInfo } from './project-info.js'
import { promptTeamConfig } from './team-config.js'
import { promptI18nConfig } from './i18n-config.js'
import { promptBillingConfig } from './billing-config.js'
import { promptFeaturesConfig } from './features-config.js'
import { promptAuthConfig, getDefaultAuthConfig } from './auth-config.js'
import { promptDashboardConfig, getDefaultDashboardConfig } from './dashboard-config.js'
import { promptDevConfig, getDefaultDevConfig } from './dev-config.js'

export {
  promptProjectInfo,
  promptTeamConfig,
  promptI18nConfig,
  promptBillingConfig,
  promptFeaturesConfig,
  promptAuthConfig,
  promptDashboardConfig,
  promptDevConfig,
}

/**
 * Run all prompts in sequence (interactive mode - 8 steps)
 */
export async function runAllPrompts(): Promise<WizardConfig> {
  // Step 1: Project Info
  const projectInfo = await promptProjectInfo()

  // Step 2: Team Configuration
  const teamConfig = await promptTeamConfig()

  // Step 3: i18n Configuration
  const i18nConfig = await promptI18nConfig()

  // Step 4: Billing Configuration
  const billingConfig = await promptBillingConfig()

  // Step 5: Features Configuration
  const featuresConfig = await promptFeaturesConfig()

  // Step 6: Authentication Configuration
  const authConfig = await promptAuthConfig('interactive', 8)

  // Step 7: Dashboard Configuration
  const dashboardConfig = await promptDashboardConfig('interactive', 8)

  // Step 8: Dev Tools Configuration
  const devConfig = await promptDevConfig('interactive', 8)

  // Combine all configurations
  return {
    ...projectInfo,
    ...teamConfig,
    ...i18nConfig,
    ...billingConfig,
    ...featuresConfig,
    ...authConfig,
    ...dashboardConfig,
    ...devConfig,
  }
}

/**
 * Run quick prompts only (steps 1-5) with defaults for steps 6-8
 */
export async function runQuickPrompts(): Promise<WizardConfig> {
  // Step 1: Project Info
  const projectInfo = await promptProjectInfo()

  // Step 2: Team Configuration
  const teamConfig = await promptTeamConfig()

  // Step 3: i18n Configuration
  const i18nConfig = await promptI18nConfig()

  // Step 4: Billing Configuration
  const billingConfig = await promptBillingConfig()

  // Step 5: Features Configuration
  const featuresConfig = await promptFeaturesConfig()

  // Use defaults for steps 6-8
  const authConfig = { auth: getDefaultAuthConfig() }
  const dashboardConfig = { dashboard: getDefaultDashboardConfig() }
  const devConfig = { dev: getDefaultDevConfig() }

  // Combine all configurations
  return {
    ...projectInfo,
    ...teamConfig,
    ...i18nConfig,
    ...billingConfig,
    ...featuresConfig,
    ...authConfig,
    ...dashboardConfig,
    ...devConfig,
  }
}

/**
 * Run all prompts with expert options (all 8 steps with advanced settings)
 */
export async function runExpertPrompts(): Promise<WizardConfig> {
  // Step 1: Project Info
  const projectInfo = await promptProjectInfo()

  // Step 2: Team Configuration
  const teamConfig = await promptTeamConfig()

  // Step 3: i18n Configuration
  const i18nConfig = await promptI18nConfig()

  // Step 4: Billing Configuration
  const billingConfig = await promptBillingConfig()

  // Step 5: Features Configuration
  const featuresConfig = await promptFeaturesConfig()

  // Step 6: Authentication Configuration (expert mode)
  const authConfig = await promptAuthConfig('expert', 8)

  // Step 7: Dashboard Configuration (expert mode)
  const dashboardConfig = await promptDashboardConfig('expert', 8)

  // Step 8: Dev Tools Configuration (expert mode)
  const devConfig = await promptDevConfig('expert', 8)

  // Combine all configurations
  return {
    ...projectInfo,
    ...teamConfig,
    ...i18nConfig,
    ...billingConfig,
    ...featuresConfig,
    ...authConfig,
    ...dashboardConfig,
    ...devConfig,
  }
}
