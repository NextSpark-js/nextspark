/**
 * Prompts Index
 *
 * Exports all prompts and provides functions to run prompts in sequence.
 * Supports different modes: interactive (all 10 steps), quick (all 10 steps), expert (all with extra options).
 */

import type { WizardConfig } from '../types.js'
import { promptProjectInfo } from './project-info.js'
import { promptProjectType, getDefaultProjectType } from './project-type.js'
import { promptTeamConfig } from './team-config.js'
import { promptI18nConfig } from './i18n-config.js'
import { promptBillingConfig } from './billing-config.js'
import { promptFeaturesConfig } from './features-config.js'
import { promptContentFeaturesConfig, getDefaultContentFeaturesConfig } from './content-features-config.js'
import { promptAuthConfig, getDefaultAuthConfig } from './auth-config.js'
import { promptDashboardConfig, getDefaultDashboardConfig } from './dashboard-config.js'
import { promptDevConfig, getDefaultDevConfig } from './dev-config.js'
// Theme & Plugin Selection
import { promptThemeSelection, type ThemeChoice } from './theme-selection.js'
import { promptPluginsSelection, getRequiredPlugins, type PluginChoice } from './plugins-selection.js'
// DX improvement prompts
import { promptEnvSetup, getDefaultEnvSetupAnswers, type EnvSetupAnswers } from './env-config.js'
import { promptGitSetup, getDefaultGitSetupAnswers, type GitSetupAnswers } from './git-config.js'

export {
  promptProjectInfo,
  promptProjectType,
  getDefaultProjectType,
  promptTeamConfig,
  promptI18nConfig,
  promptBillingConfig,
  promptFeaturesConfig,
  promptContentFeaturesConfig,
  getDefaultContentFeaturesConfig,
  promptAuthConfig,
  promptDashboardConfig,
  promptDevConfig,
  // Theme & Plugin Selection
  promptThemeSelection,
  promptPluginsSelection,
  getRequiredPlugins,
  // DX prompts
  promptEnvSetup,
  getDefaultEnvSetupAnswers,
  promptGitSetup,
  getDefaultGitSetupAnswers,
}

export type { EnvSetupAnswers, GitSetupAnswers, ThemeChoice, PluginChoice }

/**
 * Run all prompts in sequence (interactive mode - 10 steps)
 */
export async function runAllPrompts(): Promise<WizardConfig> {
  // Step 1: Project Type (web only or web + mobile) - FIRST to determine folder structure
  const projectTypeConfig = await promptProjectType()

  // Step 2: Project Info (name, slug, description)
  const projectInfo = await promptProjectInfo()

  // Step 3: Team Configuration
  const teamConfig = await promptTeamConfig()

  // Step 4: i18n Configuration
  const i18nConfig = await promptI18nConfig()

  // Step 5: Billing Configuration
  const billingConfig = await promptBillingConfig()

  // Step 6: Features Configuration
  const featuresConfig = await promptFeaturesConfig()

  // Step 7: Content Features Configuration
  const contentFeaturesConfig = await promptContentFeaturesConfig('interactive', 10)

  // Step 8: Authentication Configuration
  const authConfig = await promptAuthConfig('interactive', 10)

  // Step 9: Dashboard Configuration
  const dashboardConfig = await promptDashboardConfig('interactive', 10)

  // Step 10: Dev Tools Configuration
  const devConfig = await promptDevConfig('interactive', 10)

  // Combine all configurations
  return {
    ...projectInfo,
    ...projectTypeConfig,
    ...teamConfig,
    ...i18nConfig,
    ...billingConfig,
    ...featuresConfig,
    ...contentFeaturesConfig,
    ...authConfig,
    ...dashboardConfig,
    ...devConfig,
  }
}

/**
 * Run quick prompts (steps 1-7) with defaults for steps 8-10
 */
export async function runQuickPrompts(): Promise<WizardConfig> {
  // Step 1: Project Type (web only or web + mobile) - FIRST to determine folder structure
  const projectTypeConfig = await promptProjectType()

  // Step 2: Project Info (name, slug, description)
  const projectInfo = await promptProjectInfo()

  // Step 3: Team Configuration
  const teamConfig = await promptTeamConfig()

  // Step 4: i18n Configuration
  const i18nConfig = await promptI18nConfig()

  // Step 5: Billing Configuration
  const billingConfig = await promptBillingConfig()

  // Step 6: Features Configuration
  const featuresConfig = await promptFeaturesConfig()

  // Step 7: Content Features Configuration (shown in all modes)
  const contentFeaturesConfig = await promptContentFeaturesConfig('quick', 10)

  // Use defaults for steps 8-10
  const authConfig = { auth: getDefaultAuthConfig() }
  const dashboardConfig = { dashboard: getDefaultDashboardConfig() }
  const devConfig = { dev: getDefaultDevConfig() }

  // Combine all configurations
  return {
    ...projectInfo,
    ...projectTypeConfig,
    ...teamConfig,
    ...i18nConfig,
    ...billingConfig,
    ...featuresConfig,
    ...contentFeaturesConfig,
    ...authConfig,
    ...dashboardConfig,
    ...devConfig,
  }
}

/**
 * Run all prompts with expert options (all 10 steps with advanced settings)
 */
export async function runExpertPrompts(): Promise<WizardConfig> {
  // Step 1: Project Type (web only or web + mobile) - FIRST to determine folder structure
  const projectTypeConfig = await promptProjectType()

  // Step 2: Project Info (name, slug, description)
  const projectInfo = await promptProjectInfo()

  // Step 3: Team Configuration
  const teamConfig = await promptTeamConfig()

  // Step 4: i18n Configuration
  const i18nConfig = await promptI18nConfig()

  // Step 5: Billing Configuration
  const billingConfig = await promptBillingConfig()

  // Step 6: Features Configuration
  const featuresConfig = await promptFeaturesConfig()

  // Step 7: Content Features Configuration
  const contentFeaturesConfig = await promptContentFeaturesConfig('expert', 10)

  // Step 8: Authentication Configuration (expert mode)
  const authConfig = await promptAuthConfig('expert', 10)

  // Step 9: Dashboard Configuration (expert mode)
  const dashboardConfig = await promptDashboardConfig('expert', 10)

  // Step 10: Dev Tools Configuration (expert mode)
  const devConfig = await promptDevConfig('expert', 10)

  // Combine all configurations
  return {
    ...projectInfo,
    ...projectTypeConfig,
    ...teamConfig,
    ...i18nConfig,
    ...billingConfig,
    ...featuresConfig,
    ...contentFeaturesConfig,
    ...authConfig,
    ...dashboardConfig,
    ...devConfig,
  }
}
