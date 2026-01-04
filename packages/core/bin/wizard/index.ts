/**
 * NextSpark Wizard Orchestrator
 *
 * Main wizard entry point that runs all prompts in sequence
 * and generates the project based on user responses.
 */

import chalk from 'chalk'
import ora from 'ora'
import { confirm } from '@inquirer/prompts'
import { showBanner, showSection, showSuccess, showError, showInfo, showWarning } from './banner.js'
import { runAllPrompts, runQuickPrompts, runExpertPrompts } from './prompts/index.js'
import { generateProject } from './generators/index.js'
import { getPreset, applyPreset, PRESET_DESCRIPTIONS } from './presets.js'
import type { WizardConfig, CLIOptions } from './types.js'
import { promptProjectInfo } from './prompts/project-info.js'

/**
 * Run the complete wizard with mode support
 */
export async function runWizard(options: CLIOptions = { mode: 'interactive' }): Promise<void> {
  // Show welcome banner
  showBanner()

  // Show mode indicator
  showModeIndicator(options)

  try {
    let config: WizardConfig

    if (options.preset) {
      // Preset mode: get project info then apply preset
      config = await runPresetMode(options.preset)
    } else {
      // Run prompts based on mode
      switch (options.mode) {
        case 'quick':
          config = await runQuickPrompts()
          break
        case 'expert':
          config = await runExpertPrompts()
          break
        case 'interactive':
        default:
          config = await runAllPrompts()
          break
      }
    }

    // Show summary before generating
    showConfigSummary(config)

    // Ask for confirmation before proceeding
    console.log('')
    const proceed = await confirm({
      message: 'Proceed with project generation?',
      default: true,
    })

    if (!proceed) {
      console.log('')
      showInfo('Project generation cancelled. No changes were made.')
      process.exit(0)
    }

    // Generate the project
    console.log('')
    const spinner = ora({
      text: 'Generating your NextSpark project...',
      prefixText: '  ',
    }).start()

    try {
      await generateProject(config)
      spinner.succeed('Project generated successfully!')
    } catch (error) {
      spinner.fail('Failed to generate project')
      throw error
    }

    // Show next steps
    showNextSteps(config)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('User force closed')) {
        console.log('')
        showInfo('Wizard cancelled. No changes were made.')
        process.exit(0)
      }
      showError(error.message)
    }
    process.exit(1)
  }
}

/**
 * Show mode indicator at the start
 */
function showModeIndicator(options: CLIOptions): void {
  if (options.preset) {
    showInfo(`Using preset: ${chalk.cyan(options.preset)} - ${PRESET_DESCRIPTIONS[options.preset]}`)
    console.log('')
  } else if (options.mode === 'quick') {
    showInfo('Quick mode: Running essential prompts only (steps 1-5)')
    console.log('')
  } else if (options.mode === 'expert') {
    showInfo('Expert mode: Running all prompts with advanced options')
    console.log('')
  }
}

/**
 * Run preset mode: only project info, then apply preset defaults
 */
async function runPresetMode(presetName: CLIOptions['preset']): Promise<WizardConfig> {
  if (!presetName) {
    throw new Error('Preset name is required for preset mode')
  }

  showSection('Project Information', 1, 1)
  showInfo('Using preset defaults. Only project information is required.')
  console.log('')

  // Get project info from user
  const projectInfo = await promptProjectInfo()

  // Apply preset to project info
  const config = applyPreset(projectInfo, presetName)

  return config
}

/**
 * Display configuration summary before generating
 */
function showConfigSummary(config: WizardConfig): void {
  console.log('')
  console.log(chalk.cyan('  ' + '='.repeat(60)))
  console.log(chalk.bold.white('  Configuration Summary'))
  console.log(chalk.cyan('  ' + '='.repeat(60)))
  console.log('')

  console.log(chalk.white('  Project:'))
  console.log(chalk.gray(`    Name: ${chalk.white(config.projectName)}`))
  console.log(chalk.gray(`    Slug: ${chalk.white(config.projectSlug)}`))
  console.log(chalk.gray(`    Description: ${chalk.white(config.projectDescription)}`))
  console.log('')

  console.log(chalk.white('  Team Mode:'))
  console.log(chalk.gray(`    Mode: ${chalk.white(config.teamMode)}`))
  console.log(chalk.gray(`    Roles: ${chalk.white(config.teamRoles.join(', '))}`))
  console.log('')

  console.log(chalk.white('  Internationalization:'))
  console.log(chalk.gray(`    Default: ${chalk.white(config.defaultLocale)}`))
  console.log(chalk.gray(`    Languages: ${chalk.white(config.supportedLocales.join(', '))}`))
  console.log('')

  console.log(chalk.white('  Billing:'))
  console.log(chalk.gray(`    Model: ${chalk.white(config.billingModel)}`))
  console.log(chalk.gray(`    Currency: ${chalk.white(config.currency.toUpperCase())}`))
  console.log('')

  console.log(chalk.white('  Features:'))
  const enabledFeatures = Object.entries(config.features)
    .filter(([_, enabled]) => enabled)
    .map(([feature]) => feature)
  console.log(chalk.gray(`    Enabled: ${chalk.white(enabledFeatures.join(', ') || 'None')}`))
  console.log('')

  console.log(chalk.white('  Authentication:'))
  const enabledAuth = Object.entries(config.auth)
    .filter(([_, enabled]) => enabled)
    .map(([method]) => formatAuthMethod(method))
  console.log(chalk.gray(`    Methods: ${chalk.white(enabledAuth.join(', ') || 'None')}`))
  console.log('')

  console.log(chalk.white('  Dashboard:'))
  const enabledDashboard = Object.entries(config.dashboard)
    .filter(([_, enabled]) => enabled)
    .map(([feature]) => formatDashboardFeature(feature))
  console.log(chalk.gray(`    Features: ${chalk.white(enabledDashboard.join(', ') || 'None')}`))
  console.log('')

  console.log(chalk.white('  Dev Tools:'))
  const enabledDevTools = Object.entries(config.dev)
    .filter(([_, enabled]) => enabled)
    .map(([tool]) => formatDevTool(tool))
  console.log(chalk.gray(`    Enabled: ${chalk.white(enabledDevTools.join(', ') || 'None')}`))
}

/**
 * Format authentication method name for display
 */
function formatAuthMethod(method: string): string {
  const mapping: Record<string, string> = {
    emailPassword: 'Email/Password',
    magicLink: 'Magic Link',
    googleOAuth: 'Google',
    githubOAuth: 'GitHub',
    emailVerification: 'Email Verification',
    twoFactor: '2FA',
  }
  return mapping[method] || method
}

/**
 * Format dashboard feature name for display
 */
function formatDashboardFeature(feature: string): string {
  const mapping: Record<string, string> = {
    search: 'Search',
    notifications: 'Notifications',
    themeToggle: 'Theme Toggle',
    sidebarCollapsed: 'Sidebar Collapsed',
  }
  return mapping[feature] || feature
}

/**
 * Format dev tool name for display
 */
function formatDevTool(tool: string): string {
  const mapping: Record<string, string> = {
    devKeyring: 'Dev Keyring',
    debugMode: 'Debug Mode',
  }
  return mapping[tool] || tool
}

/**
 * Display next steps after successful generation
 */
function showNextSteps(config: WizardConfig): void {
  console.log('')
  console.log(chalk.cyan('  ' + '='.repeat(60)))
  console.log(chalk.bold.green('  ✨ NextSpark project created successfully!'))
  console.log(chalk.cyan('  ' + '='.repeat(60)))
  console.log('')

  console.log(chalk.bold.white('  Next steps:'))
  console.log('')

  console.log(chalk.white('  1. Install dependencies:'))
  console.log(chalk.cyan('     pnpm install'))
  console.log('')

  console.log(chalk.white('  2. Set up your environment:'))
  console.log(chalk.gray('     Copy .env.example to .env and configure:'))
  console.log(chalk.yellow('     - DATABASE_URL'))
  console.log(chalk.yellow('     - BETTER_AUTH_SECRET'))
  console.log(chalk.yellow(`     - NEXT_PUBLIC_ACTIVE_THEME=${config.projectSlug}`))
  console.log('')

  console.log(chalk.white('  3. Generate registries:'))
  console.log(chalk.cyan('     pnpm build:registries'))
  console.log('')

  console.log(chalk.white('  4. Run database migrations:'))
  console.log(chalk.cyan('     pnpm db:migrate'))
  console.log('')

  console.log(chalk.white('  5. Start the development server:'))
  console.log(chalk.cyan('     pnpm dev'))
  console.log('')

  console.log(chalk.gray('  ' + '-'.repeat(60)))
  console.log(chalk.gray(`  Your theme is located at: ${chalk.white(`contents/themes/${config.projectSlug}/`)}`))
  console.log(chalk.gray('  Documentation: https://nextspark.dev/docs'))
  console.log('')
}
