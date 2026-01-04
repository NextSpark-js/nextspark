#!/usr/bin/env node
/**
 * NextSpark CLI - Init Command
 *
 * Entry point for the `npx nextspark init` command.
 * This wizard guides users through creating a new NextSpark project.
 *
 * Usage:
 *   npx nextspark init              # Interactive mode (all 8 steps)
 *   npx nextspark init --quick      # Quick mode (steps 1-5 only)
 *   npx nextspark init --expert     # Expert mode (all steps + extra options)
 *   npx nextspark init --preset=saas    # Use SaaS preset
 *   npx nextspark init --preset=blog    # Use blog preset
 *   npx nextspark init --preset=crm     # Use CRM preset
 *   npx nextspark init --help       # Show help
 */

import chalk from 'chalk'
import { runWizard } from './wizard/index.js'
import type { CLIOptions, WizardMode, PresetName } from './wizard/types.js'
import { isValidPreset, getAvailablePresets, PRESET_DESCRIPTIONS } from './wizard/presets.js'

/**
 * Show CLI help message
 */
function showHelp(): void {
  console.log('')
  console.log(chalk.bold.white('NextSpark CLI - Project Initialization Wizard'))
  console.log('')
  console.log(chalk.white('Usage:'))
  console.log(chalk.cyan('  npx nextspark init [options]'))
  console.log('')
  console.log(chalk.white('Options:'))
  console.log(chalk.gray('  --quick       Quick mode - Only essential prompts (steps 1-5)'))
  console.log(chalk.gray('  --expert      Expert mode - All prompts with advanced options'))
  console.log(chalk.gray('  --preset=NAME Use a preset configuration'))
  console.log(chalk.gray('  --help        Show this help message'))
  console.log('')
  console.log(chalk.white('Available presets:'))
  for (const preset of getAvailablePresets()) {
    console.log(chalk.gray(`  ${chalk.cyan(preset.padEnd(8))} ${PRESET_DESCRIPTIONS[preset]}`))
  }
  console.log('')
  console.log(chalk.white('Examples:'))
  console.log(chalk.gray('  npx nextspark init              # Start interactive wizard'))
  console.log(chalk.gray('  npx nextspark init --quick      # Quick setup with defaults'))
  console.log(chalk.gray('  npx nextspark init --preset=saas # Use SaaS template'))
  console.log('')
}

/**
 * Parse command line arguments
 */
function parseArgs(): CLIOptions | null {
  const args = process.argv.slice(2)

  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    showHelp()
    return null
  }

  // Determine mode
  let mode: WizardMode = 'interactive'
  if (args.includes('--quick')) {
    mode = 'quick'
  } else if (args.includes('--expert')) {
    mode = 'expert'
  }

  // Check for preset
  let preset: PresetName | undefined
  const presetArg = args.find((a) => a.startsWith('--preset='))
  if (presetArg) {
    const presetName = presetArg.split('=')[1]
    if (!presetName) {
      console.error(chalk.red('Error: --preset requires a value (e.g., --preset=saas)'))
      console.log(chalk.gray(`Available presets: ${getAvailablePresets().join(', ')}`))
      process.exit(1)
    }
    if (!isValidPreset(presetName)) {
      console.error(chalk.red(`Error: Unknown preset "${presetName}"`))
      console.log(chalk.gray(`Available presets: ${getAvailablePresets().join(', ')}`))
      process.exit(1)
    }
    preset = presetName
  }

  return { mode, preset }
}

// Parse arguments and run wizard
const options = parseArgs()

if (options) {
  runWizard(options).catch((error: Error) => {
    console.error('An unexpected error occurred:', error.message)
    process.exit(1)
  })
}
