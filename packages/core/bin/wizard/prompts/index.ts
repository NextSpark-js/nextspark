/**
 * Prompts Index
 *
 * Exports all prompts and provides functions to run prompts in sequence.
 * Supports different modes: interactive (all 9 steps), quick (all 9 steps), expert (all with extra options).
 */

import type { WizardConfig } from '../types.js'
import { promptProjectInfo } from './project-info.js'
import { promptTeamConfig } from './team-config.js'
import { promptI18nConfig } from './i18n-config.js'
import { promptBillingConfig } from './billing-config.js'
import { promptFeaturesConfig } from './features-config.js'
import { promptContentFeaturesConfig, getDefaultContentFeaturesConfig } from './content-features-config.js'
import { promptAuthConfig, getDefaultAuthConfig } from './auth-config.js'
import { promptDashboardConfig, getDefaultDashboardConfig } from './dashboard-config.js'
import { promptDevConfig, getDefaultDevConfig } from './dev-config.js'
// New DX improvement prompts
import { promptDemoInstall } from './demo-install.js'
import { promptEnvSetup, getDefaultEnvSetupAnswers, type EnvSetupAnswers } from './env-config.js'
import { promptGitSetup, getDefaultGitSetupAnswers, type GitSetupAnswers } from './git-config.js'

export {
  promptProjectInfo,
  promptTeamConfig,
  promptI18nConfig,
  promptBillingConfig,
  promptFeaturesConfig,
  promptContentFeaturesConfig,
  getDefaultContentFeaturesConfig,
  promptAuthConfig,
  promptDashboardConfig,
  promptDevConfig,
  // New DX prompts
  promptDemoInstall,
  promptEnvSetup,
  getDefaultEnvSetupAnswers,
  promptGitSetup,
  getDefaultGitSetupAnswers,
}

export type { EnvSetupAnswers, GitSetupAnswers }

/**
 * Run all prompts in sequence (interactive mode - 9 steps)
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

  // Step 6: Content Features Configuration
  const contentFeaturesConfig = await promptContentFeaturesConfig('interactive', 9)

  // Step 7: Authentication Configuration
  const authConfig = await promptAuthConfig('interactive', 9)

  // Step 8: Dashboard Configuration
  const dashboardConfig = await promptDashboardConfig('interactive', 9)

  // Step 9: Dev Tools Configuration
  const devConfig = await promptDevConfig('interactive', 9)

  // Combine all configurations
  return {
    ...projectInfo,
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
 * Run quick prompts (steps 1-6) with defaults for steps 7-9
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

  // Step 6: Content Features Configuration (shown in all modes)
  const contentFeaturesConfig = await promptContentFeaturesConfig('quick', 9)

  // Use defaults for steps 7-9
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
    ...contentFeaturesConfig,
    ...authConfig,
    ...dashboardConfig,
    ...devConfig,
  }
}

/**
 * Run all prompts with expert options (all 9 steps with advanced settings)
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

  // Step 6: Content Features Configuration
  const contentFeaturesConfig = await promptContentFeaturesConfig('expert', 9)

  // Step 7: Authentication Configuration (expert mode)
  const authConfig = await promptAuthConfig('expert', 9)

  // Step 8: Dashboard Configuration (expert mode)
  const dashboardConfig = await promptDashboardConfig('expert', 9)

  // Step 9: Dev Tools Configuration (expert mode)
  const devConfig = await promptDevConfig('expert', 9)

  // Combine all configurations
  return {
    ...projectInfo,
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
