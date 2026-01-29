/**
 * NextSpark Wizard Orchestrator
 *
 * Main wizard entry point that runs all prompts in sequence
 * and generates the project based on user responses.
 */

import chalk from 'chalk'
import ora from 'ora'
import { confirm, select } from '@inquirer/prompts'
import { execSync } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import { join, resolve } from 'path'
import { showBanner, showSection, showSuccess, showError, showInfo, showWarning } from './banner.js'
import { runAllPrompts, runQuickPrompts, runExpertPrompts } from './prompts/index.js'
import { generateProject, isMonorepoProject, getWebDir } from './generators/index.js'
import { getPreset, applyPreset, PRESET_DESCRIPTIONS } from './presets.js'
import type { WizardConfig, CLIOptions } from './types.js'
import { promptProjectInfo } from './prompts/project-info.js'
// Theme & Plugin Selection
import { promptThemeSelection, promptPluginsSelection, getRequiredPlugins, type ThemeChoice, type PluginChoice } from './prompts/index.js'
import { installThemeAndPlugins } from './generators/theme-plugins-installer.js'
import { showConfigPreview } from './preview.js'

/**
 * Project info type for non-interactive mode
 */
interface ProjectInfo {
  projectName: string
  projectSlug: string
  projectDescription: string
}

/**
 * Get project info from CLI options for non-interactive mode
 * Returns null if any required field is missing
 */
function getProjectInfoFromOptions(options: CLIOptions): ProjectInfo | null {
  if (options.name && options.slug && options.description) {
    return {
      projectName: options.name,
      projectSlug: options.slug,
      projectDescription: options.description,
    }
  }
  return null
}

/**
 * Run the complete wizard with mode support
 */
export async function runWizard(options: CLIOptions = { mode: 'interactive' }): Promise<void> {
  // Show welcome banner
  showBanner()

  // Show mode indicator
  showModeIndicator(options)

  try {
    let selectedTheme: ThemeChoice = null
    let selectedPlugins: PluginChoice[] = []
    let config: WizardConfig

    if (options.preset) {
      // Preset mode: get project info then apply preset
      config = await runPresetMode(options.preset, options)
    } else {
      // Run prompts based on mode
      // Order: 1. Type, 2. Info, 3-10. Config options
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

    // Theme & Plugin Selection (AFTER project type and info)
    // This ensures we know the project structure before asking about themes
    if (options.theme !== undefined) {
      // Non-interactive mode: use CLI flags
      selectedTheme = options.theme === 'none' ? null : options.theme as ThemeChoice
      showInfo(`Reference theme: ${selectedTheme || 'None'}`)
    } else if (!options.preset && options.mode !== 'quick') {
      // Interactive mode: prompt user (only if not using preset)
      selectedTheme = await promptThemeSelection()
    }

    // Plugins selection
    if (options.plugins !== undefined) {
      selectedPlugins = options.plugins as PluginChoice[]
      if (selectedPlugins.length > 0) {
        showInfo(`Selected plugins: ${selectedPlugins.join(', ')}`)
      }
    } else if (!options.preset && options.mode !== 'quick' && !options.yes) {
      // Interactive mode: prompt user (skip in --yes mode or preset mode)
      selectedPlugins = await promptPluginsSelection(selectedTheme)
    } else if (selectedTheme) {
      // In quick/yes/preset mode, auto-include required plugins for theme
      selectedPlugins = getRequiredPlugins(selectedTheme)
    }

    // Show summary before generating
    showConfigSummary(config)

    // Show interactive preview of files to be created
    showConfigPreview(config)

    // Ask for confirmation before proceeding (skip with --yes flag)
    if (!options.yes) {
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
    }

    // Install @nextsparkjs/core first (required for templates)
    console.log('')
    const coreInstalled = await installCore()
    if (!coreInstalled) {
      showError('Failed to install @nextsparkjs/core. Cannot generate project.')
      process.exit(1)
    }

    // For monorepo projects, also install @nextsparkjs/mobile (required for mobile templates)
    if (config.projectType === 'web-mobile') {
      console.log('')
      const mobileInstalled = await installMobile()
      if (!mobileInstalled) {
        showError('Failed to install @nextsparkjs/mobile. Cannot generate monorepo project.')
        process.exit(1)
      }
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

    // Install theme and plugins after project generation
    if (selectedTheme || selectedPlugins.length > 0) {
      await installThemeAndPlugins(selectedTheme, selectedPlugins)
    }

    // Determine the web directory for monorepo projects
    const projectRoot = process.cwd()
    const webDir = getWebDir(projectRoot, config)
    const isMonorepo = isMonorepoProject(config)

    // Install all dependencies
    const installSpinner = ora({
      text: isMonorepo ? 'Installing dependencies (monorepo)...' : 'Installing dependencies...',
      prefixText: '  ',
    }).start()

    try {
      // TODO: Change back to stdio: 'pipe' once Windows issues are resolved
      installSpinner.stop()
      execSync('pnpm install --force', {
        cwd: projectRoot, // Always install from root (works for both flat and monorepo)
        stdio: 'inherit',
      })
      installSpinner.succeed('Dependencies installed!')
    } catch (error) {
      installSpinner.fail('Failed to install dependencies')
      console.log(chalk.yellow('  Run "pnpm install" manually to install dependencies'))
    }

    // Build registries using the core's registry builder
    const registrySpinner = ora({
      text: 'Building registries...',
      prefixText: '  ',
    }).start()

    try {
      // For monorepo, registry script is in web/node_modules
      const registryScript = join(webDir, 'node_modules/@nextsparkjs/core/scripts/build/registry.mjs')
      // TODO: Change back to stdio: 'pipe' once Windows issues are resolved
      registrySpinner.stop()
      execSync(`node "${registryScript}" --build`, {
        cwd: webDir, // Run from web directory
        stdio: 'inherit',
        env: {
          ...process.env,
          NEXTSPARK_PROJECT_ROOT: webDir,
        },
      })
      registrySpinner.succeed('Registries built!')
    } catch (error) {
      registrySpinner.fail('Failed to build registries')
      const devCmd = isMonorepo ? 'pnpm dev' : 'pnpm dev'
      console.log(chalk.yellow(`  Registries will be built automatically when you run "${devCmd}"`))
    }

    // AI Workflow setup (optional)
    await promptAIWorkflowSetup()

    // Show next steps
    showNextSteps(config, selectedTheme)
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
 * Supports non-interactive mode when CLI options provide all project info
 */
async function runPresetMode(presetName: CLIOptions['preset'], options: CLIOptions): Promise<WizardConfig> {
  if (!presetName) {
    throw new Error('Preset name is required for preset mode')
  }

  // Check for non-interactive mode
  const projectInfoFromOptions = getProjectInfoFromOptions(options)

  let projectInfo: ProjectInfo

  if (projectInfoFromOptions) {
    // Non-interactive mode: use CLI options
    projectInfo = projectInfoFromOptions
    showInfo(`Project: ${projectInfo.projectName} (${projectInfo.projectSlug})`)
  } else {
    // Interactive mode: prompt for project info
    showSection('Project Information', 1, 1)
    showInfo('Using preset defaults. Only project information is required.')
    console.log('')

    // Get project info from user
    projectInfo = await promptProjectInfo()
  }

  // Apply preset to project info (with optional type override from CLI)
  const config = applyPreset(projectInfo, presetName, options.type)

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
  console.log(chalk.gray(`    Type: ${chalk.white(config.projectType === 'web-mobile' ? 'Web + Mobile (Monorepo)' : 'Web only')}`))
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
    googleOAuth: 'Google',
    emailVerification: 'Email Verification',
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
function showNextSteps(config: WizardConfig, referenceTheme: ThemeChoice = null): void {
  const isMonorepo = config.projectType === 'web-mobile'

  console.log('')
  console.log(chalk.cyan('  ' + '='.repeat(60)))
  console.log(chalk.bold.green('  ✨ NextSpark project ready!'))
  console.log(chalk.cyan('  ' + '='.repeat(60)))
  console.log('')

  console.log(chalk.bold.white('  Next steps:'))
  console.log('')

  // Step 1: Configure .env (already created, just edit values)
  const envPath = isMonorepo ? 'web/.env' : '.env'
  console.log(chalk.white('  1. Configure your .env file:'))
  console.log(chalk.gray(`     Edit these values in ${envPath}:`))
  console.log('')
  console.log(chalk.yellow('     DATABASE_URL'))
  console.log(chalk.gray('     PostgreSQL connection string'))
  console.log(chalk.dim('     Example: postgresql://user:pass@localhost:5432/mydb'))
  console.log('')
  console.log(chalk.yellow('     BETTER_AUTH_SECRET'))
  console.log(chalk.gray('     Generate with:'))
  console.log(chalk.cyan('     openssl rand -base64 32'))
  console.log('')

  // Step 2: Run migrations
  console.log(chalk.white('  2. Run database migrations:'))
  console.log(chalk.cyan('     pnpm db:migrate'))
  console.log('')

  // Step 3: Start dev server
  console.log(chalk.white('  3. Start the development server:'))
  console.log(chalk.cyan('     pnpm dev'))
  console.log('')

  // Mobile-specific steps for monorepo
  if (isMonorepo) {
    console.log(chalk.white('  4. (Optional) Start the mobile app:'))
    console.log(chalk.cyan('     pnpm dev:mobile'))
    console.log(chalk.gray('     Or: cd mobile && pnpm start'))
    console.log('')
  }

  // Footer info
  console.log(chalk.gray('  ' + '-'.repeat(60)))

  if (isMonorepo) {
    console.log(chalk.gray(`  Structure: ${chalk.white('Monorepo (web/ + mobile/)')}`))
    console.log(chalk.gray(`  Web theme: ${chalk.white(`web/contents/themes/${config.projectSlug}/`)}`))
    console.log(chalk.gray(`  Mobile app: ${chalk.white('mobile/')}`))
    console.log(chalk.gray(`  Active theme: ${chalk.green(`NEXT_PUBLIC_ACTIVE_THEME=${config.projectSlug}`)}`))
  } else {
    console.log(chalk.gray(`  Theme: ${chalk.white(`contents/themes/${config.projectSlug}/`)}`))
    console.log(chalk.gray(`  Active theme: ${chalk.green(`NEXT_PUBLIC_ACTIVE_THEME=${config.projectSlug}`)}`))
  }

  if (referenceTheme) {
    const refPath = isMonorepo ? `web/contents/themes/${referenceTheme}/` : `contents/themes/${referenceTheme}/`
    console.log(chalk.gray(`  Reference: ${chalk.white(refPath)}`))
  }
  console.log('')
  console.log(chalk.white(`  ${isMonorepo ? '5' : '4'}. (Optional) Setup AI workflows:`))
  console.log(chalk.cyan('     nextspark setup:ai'))
  console.log('')

  console.log(chalk.gray('  Docs: https://nextspark.dev/docs'))
  console.log('')
}

/**
 * Prompt user for AI workflow setup (optional step at end of wizard)
 */
async function promptAIWorkflowSetup(): Promise<void> {
  console.log('')
  console.log(chalk.cyan('  ' + '='.repeat(60)))
  console.log(chalk.bold.white('  AI Workflow Setup (Optional)'))
  console.log(chalk.cyan('  ' + '='.repeat(60)))
  console.log('')

  const choice = await select({
    message: 'Setup AI-assisted development workflows?',
    choices: [
      { name: 'Claude Code (Recommended)', value: 'claude' },
      { name: 'Cursor (Coming soon)', value: 'cursor' },
      { name: 'Antigravity (Coming soon)', value: 'antigravity' },
      { name: 'Skip for now', value: 'skip' },
    ],
  })

  if (choice === 'skip') {
    showInfo('Skipped AI workflow setup. Run "nextspark setup:ai" later to set up.')
    return
  }

  if (choice === 'cursor' || choice === 'antigravity') {
    showInfo(`${choice} support is coming soon. For now, use Claude Code.`)
    return
  }

  // Install @nextsparkjs/ai-workflow
  const spinner = ora({
    text: 'Installing @nextsparkjs/ai-workflow...',
    prefixText: '  ',
  }).start()

  try {
    spinner.stop()
    execSync('pnpm add -D @nextsparkjs/ai-workflow', {
      cwd: process.cwd(),
      stdio: 'inherit',
    })

    // Run setup
    const setupScript = join(process.cwd(), 'node_modules', '@nextsparkjs', 'ai-workflow', 'scripts', 'setup.mjs')
    if (existsSync(setupScript)) {
      execSync(`node "${setupScript}" ${choice}`, {
        cwd: process.cwd(),
        stdio: 'inherit',
      })
      showSuccess('AI workflow setup complete!')
    } else {
      showWarning('AI workflow package installed but setup script not found. Run "nextspark setup:ai" manually.')
    }
  } catch (error) {
    showError('Failed to install AI workflow package. Run "nextspark setup:ai" later.')
  }
}

/**
 * Find local tarball for core package
 * Looks for .tgz files in current directory
 */
function findLocalCoreTarball(): string | null {
  const cwd = process.cwd()

  try {
    const files = readdirSync(cwd)
    const coreTarball = files.find((f) =>
      f.includes('nextsparkjs-core') && f.endsWith('.tgz')
    )
    if (coreTarball) {
      return join(cwd, coreTarball)
    }
  } catch {
    // Ignore errors
  }

  return null
}

/**
 * Check if core is already installed
 */
function isCoreInstalled(): boolean {
  const corePath = join(process.cwd(), 'node_modules', '@nextsparkjs', 'core')
  return existsSync(corePath)
}

/**
 * Install @nextsparkjs/core package
 * Required before project generation (provides templates)
 */
async function installCore(): Promise<boolean> {
  // Skip if already installed
  if (isCoreInstalled()) {
    return true
  }

  const spinner = ora({
    text: 'Installing @nextsparkjs/core...',
    prefixText: '  ',
  }).start()

  try {
    // Check for local tarball first
    const localTarball = findLocalCoreTarball()

    let packageSpec = '@nextsparkjs/core'
    if (localTarball) {
      packageSpec = localTarball
      spinner.text = 'Installing @nextsparkjs/core from local tarball...'
    }

    // Detect package manager
    const useYarn = existsSync(join(process.cwd(), 'yarn.lock'))
    const usePnpm = existsSync(join(process.cwd(), 'pnpm-lock.yaml'))

    let installCmd: string
    if (usePnpm) {
      installCmd = `pnpm add ${packageSpec}`
    } else if (useYarn) {
      installCmd = `yarn add ${packageSpec}`
    } else {
      installCmd = `npm install ${packageSpec}`
    }

    // TODO: Change back to stdio: 'pipe' once Windows issues are resolved
    spinner.stop()
    execSync(installCmd, {
      stdio: 'inherit',
      cwd: process.cwd(),
    })

    spinner.succeed(chalk.green('@nextsparkjs/core installed successfully!'))
    return true
  } catch (error) {
    spinner.fail(chalk.red('Failed to install @nextsparkjs/core'))
    if (error instanceof Error) {
      console.log(chalk.red(`  Error: ${error.message}`))
    }
    console.log(chalk.gray('  Hint: Make sure the package is available (npm registry or local tarball)'))
    return false
  }
}

/**
 * Check if mobile is already installed
 */
function isMobileInstalled(): boolean {
  const mobilePath = join(process.cwd(), 'node_modules', '@nextsparkjs', 'mobile')
  return existsSync(mobilePath)
}

/**
 * Find local tarball for mobile package
 */
function findLocalMobileTarball(): string | null {
  const cwd = process.cwd()

  try {
    const files = readdirSync(cwd)
    const mobileTarball = files.find((f) =>
      f.includes('nextsparkjs-mobile') && f.endsWith('.tgz')
    )
    if (mobileTarball) {
      return join(cwd, mobileTarball)
    }
  } catch {
    // Ignore errors
  }

  return null
}

/**
 * Install @nextsparkjs/mobile package
 * Required before monorepo project generation (provides mobile templates)
 */
async function installMobile(): Promise<boolean> {
  // Skip if already installed
  if (isMobileInstalled()) {
    return true
  }

  const spinner = ora({
    text: 'Installing @nextsparkjs/mobile...',
    prefixText: '  ',
  }).start()

  try {
    // Check for local tarball first
    const localTarball = findLocalMobileTarball()

    let packageSpec = '@nextsparkjs/mobile'
    if (localTarball) {
      packageSpec = localTarball
      spinner.text = 'Installing @nextsparkjs/mobile from local tarball...'
    }

    // Detect package manager
    const useYarn = existsSync(join(process.cwd(), 'yarn.lock'))
    const usePnpm = existsSync(join(process.cwd(), 'pnpm-lock.yaml'))

    let installCmd: string
    if (usePnpm) {
      installCmd = `pnpm add ${packageSpec}`
    } else if (useYarn) {
      installCmd = `yarn add ${packageSpec}`
    } else {
      installCmd = `npm install ${packageSpec}`
    }

    spinner.stop()
    execSync(installCmd, {
      stdio: 'inherit',
      cwd: process.cwd(),
    })

    spinner.succeed(chalk.green('@nextsparkjs/mobile installed successfully!'))
    return true
  } catch (error) {
    spinner.fail(chalk.red('Failed to install @nextsparkjs/mobile'))
    if (error instanceof Error) {
      console.log(chalk.red(`  Error: ${error.message}`))
    }
    console.log(chalk.gray('  Hint: Make sure the package is available (npm registry or local tarball)'))
    return false
  }
}

