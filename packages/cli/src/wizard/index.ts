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
import { existsSync, readdirSync, readFileSync } from 'fs'
import { basename, join, resolve } from 'path'

/**
 * Resolve the CLI's own version so @nextsparkjs/* installs can be pinned to the
 * exact matching version. Requesting an exact version bypasses the `latest`
 * dist-tag (and any stale pnpm packument cache pointing at an old `latest`),
 * which otherwise causes mismatched installs like mobile@<old> + core@<new>.
 */
function getCliVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))
    return pkg.version || 'latest'
  } catch {
    return 'latest'
  }
}
import { showBanner, showSection, showError, showInfo } from './banner.js'
import { runAllPrompts, runQuickPrompts, runExpertPrompts } from './prompts/index.js'
import { generateProject, isMonorepoProject, getWebDir } from './generators/index.js'
import { getPreset, applyPreset, PRESET_DESCRIPTIONS, DEFAULT_PRESET } from './presets.js'
import type { WizardConfig, CLIOptions } from './types.js'
import { promptProjectInfo } from './prompts/project-info.js'
// Theme & Plugin Selection
import { promptThemeSelection, promptPluginsSelection, getRequiredPlugins, type ThemeChoice, type PluginChoice } from './prompts/index.js'
import { installThemeAndPlugins } from './generators/theme-plugins-installer.js'
import { installProjectDependencies, setupAIWorkflow } from './install-dependencies.js'
import { showConfigPreview } from './preview.js'
import { errorLines } from '../utils/shown-path.js'

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
 *
 * With --yes the missing fields are derived rather than prompted for: there is
 * nobody to answer, and requiring all three (the old behaviour) sent
 * `init --preset saas --yes` to a prompt that could only fail.
 *
 * Returns null only when the run is interactive and the flags are incomplete.
 */
function getProjectInfoFromOptions(options: CLIOptions): ProjectInfo | null {
  if (options.name && options.slug && options.description) {
    return {
      projectName: options.name,
      projectSlug: options.slug,
      projectDescription: options.description,
    }
  }

  if (!options.yes) {
    return null
  }

  const projectName = options.name || basename(process.cwd())
  const projectSlug = options.slug || slugify(projectName)

  return {
    projectName,
    projectSlug,
    projectDescription: options.description || `${projectName} - built with NextSpark`,
  }
}

/** Directory names are the fallback source for a project name, so normalise them. */
function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'nextspark-app'
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

    // `--yes` means "use defaults", so it cannot fall through to prompts that
    // have no TTY to answer them. The default preset is what those defaults
    // are; an explicit --preset still wins, and --type/--theme/--plugins keep
    // overriding individual choices.
    const preset = options.preset ?? (options.yes ? DEFAULT_PRESET : undefined)

    if (preset) {
      // Preset mode: get project info then apply preset
      if (!options.preset) {
        showInfo(`No preset given with --yes; using the default preset: ${preset}`)
      }
      config = await runPresetMode(preset, options)
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
    } else if (!preset && options.mode !== 'quick') {
      // Interactive mode: prompt user (only if not using preset)
      selectedTheme = await promptThemeSelection()
    }

    // Plugins selection
    if (options.plugins !== undefined) {
      selectedPlugins = options.plugins as PluginChoice[]
      if (selectedPlugins.length > 0) {
        showInfo(`Selected plugins: ${selectedPlugins.join(', ')}`)
      }
    } else if (!preset && options.mode !== 'quick' && !options.yes) {
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
      if (!await installThemeAndPlugins(selectedTheme, selectedPlugins)) {
        throw new Error('The theme or a plugin did not install; the messages above say which.')
      }
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
      installProjectDependencies(projectRoot) // Always from root (works for both flat and monorepo)
      installSpinner.succeed('Dependencies installed!')
    } catch (error) {
      installSpinner.fail('Failed to install dependencies')
      throw error
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
    // Skip the interactive prompt in non-interactive mode (--yes): it would
    // otherwise throw on a missing TTY and abort the wizard after the project
    // has already been generated.
    const aiChoice = options.yes ? 'skip' : await promptAIWorkflowSetup(config)

    // Show next steps
    showNextSteps(config, selectedTheme, aiChoice)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('User force closed')) {
        console.log('')
        // Without a TTY nobody cancelled anything: the prompt had no one to ask.
        // That is a bad invocation, and exiting 0 made it pass for success in CI.
        if (!process.stdin.isTTY) {
          showError(
            'This run is not interactive, and the wizard still needed input. ' +
            'Pass --yes to take the defaults (optionally with --name/--slug/--description, ' +
            '--preset, --type, --theme, --plugins), or run it in a terminal.'
          )
          process.exit(1)
        }
        showInfo('Wizard cancelled. No changes were made.')
        process.exit(0)
      }
      const [first, ...rest] = errorLines(error)
      showError(first)
      for (const line of rest) console.log(chalk.red(line))
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
  console.log(chalk.gray(`    Registration: ${chalk.white(formatRegistrationMode(config.auth.registrationMode))}`))
  const enabledAuth = Object.entries(config.auth)
    .filter(([key, enabled]) => key !== 'registrationMode' && enabled)
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
 * Format registration mode for display
 */
function formatRegistrationMode(mode: string): string {
  const mapping: Record<string, string> = {
    'open': 'Open (anyone can register)',
    'domain-restricted': 'Domain-Restricted (Google OAuth only)',
    'invitation-only': 'Invitation-Only',
  }
  return mapping[mode] || mode
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
function showNextSteps(config: WizardConfig, referenceTheme: ThemeChoice = null, aiChoice: string = 'skip'): void {
  const isMonorepo = config.projectType === 'web-mobile'
  const aiSetupDone = aiChoice === 'claude'

  console.log('')
  console.log(chalk.cyan('  ' + '='.repeat(60)))
  console.log(chalk.bold.green('  ✨ NextSpark project ready!'))
  console.log(chalk.cyan('  ' + '='.repeat(60)))
  console.log('')

  console.log(chalk.bold.white('  Next steps:'))
  console.log('')

  // Step 1: Configure .env
  const envPath = isMonorepo ? 'web/.env' : '.env'
  console.log(chalk.white('  1. Configure your environment:'))
  console.log(chalk.gray(`     Edit ${envPath} with your credentials:`))
  console.log('')
  console.log(chalk.yellow('     DATABASE_URL'))
  console.log(chalk.gray('     PostgreSQL connection string'))
  console.log(chalk.gray(`     Recommended: ${chalk.cyan('https://supabase.com')} | ${chalk.cyan('https://neon.com')}`))
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

  let nextStep = 4

  // Mobile-specific step for monorepo
  if (isMonorepo) {
    console.log(chalk.white(`  ${nextStep}. (Optional) Start the mobile app:`))
    console.log(chalk.cyan('     pnpm dev:mobile'))
    console.log(chalk.gray('     Or: cd mobile && pnpm start'))
    console.log('')
    nextStep++
  }

  // AI step — conditional on what the user chose
  if (aiSetupDone) {
    console.log(chalk.white(`  ${nextStep}. Start building with AI:`))
    console.log(chalk.gray('     Open Claude Code in your project and run:'))
    console.log(chalk.cyan('     /how-to:start'))
    console.log('')
  } else {
    console.log(chalk.white(`  ${nextStep}. (Optional) Setup AI workflows:`))
    console.log(chalk.cyan('     nextspark setup:ai'))
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

  console.log(chalk.gray(`  Docs: ${chalk.cyan('https://nextspark.dev/docs')}`))
  console.log('')
}

/**
 * Prompt user for AI workflow setup (optional step at end of wizard)
 * Returns the choice made ('claude', 'cursor', 'antigravity', or 'skip')
 */
async function promptAIWorkflowSetup(config: WizardConfig): Promise<string> {
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
    return 'skip'
  }

  if (choice === 'cursor' || choice === 'antigravity') {
    showInfo(`${choice} support is coming soon. For now, use Claude Code.`)
    return 'skip'
  }

  return setupAIWorkflow({
    projectRoot: process.cwd(),
    choice,
    isMonorepo: isMonorepoProject(config),
    version: getCliVersion(),
  })
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
 * `-w ` when the current directory is a pnpm workspace root, where `pnpm add`
 * stops with ERR_PNPM_ADDING_TO_ROOT without it; create-nextspark-app starts
 * every project with a pnpm-workspace.yaml. Outside a workspace pnpm rejects
 * the flag, so it is left out there.
 */
function pnpmWorkspaceRootFlag(): string {
  return existsSync(join(process.cwd(), 'pnpm-workspace.yaml')) ? '-w ' : ''
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

    // Pin to the CLI's exact version (not the `latest` dist-tag) so the install
    // is deterministic regardless of npm dist-tags or a stale pnpm cache.
    let packageSpec = `@nextsparkjs/core@${getCliVersion()}`
    if (localTarball) {
      packageSpec = localTarball
      spinner.text = 'Installing @nextsparkjs/core from local tarball...'
    }

    // Detect package manager
    const useYarn = existsSync(join(process.cwd(), 'yarn.lock'))
    const usePnpm = existsSync(join(process.cwd(), 'pnpm-lock.yaml'))

    let installCmd: string
    if (usePnpm) {
      installCmd = `pnpm add ${pnpmWorkspaceRootFlag()}${packageSpec}`
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
    // A non-zero exit means the install did not finish, even when the package
    // already landed in node_modules.
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

    // Pin to the CLI's exact version (not the `latest` dist-tag) so the install
    // is deterministic regardless of npm dist-tags or a stale pnpm cache. This
    // prevents mobile@<old> being pulled while core/cli are <new>.
    let packageSpec = `@nextsparkjs/mobile@${getCliVersion()}`
    if (localTarball) {
      packageSpec = localTarball
      spinner.text = 'Installing @nextsparkjs/mobile from local tarball...'
    }

    // Detect package manager
    const useYarn = existsSync(join(process.cwd(), 'yarn.lock'))
    const usePnpm = existsSync(join(process.cwd(), 'pnpm-lock.yaml'))

    let installCmd: string
    if (usePnpm) {
      installCmd = `pnpm add ${pnpmWorkspaceRootFlag()}${packageSpec}`
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
    // A non-zero exit means the install did not finish, even when the package
    // already landed in node_modules.
    spinner.fail(chalk.red('Failed to install @nextsparkjs/mobile'))
    if (error instanceof Error) {
      console.log(chalk.red(`  Error: ${error.message}`))
    }
    console.log(chalk.gray('  Hint: Make sure the package is available (npm registry or local tarball)'))
    return false
  }
}

