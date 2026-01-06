/**
 * NextSpark Health Check Command (Doctor)
 *
 * Runs a comprehensive health check on a NextSpark project
 * to identify configuration issues, missing dependencies,
 * and other potential problems.
 *
 * Usage:
 *   npx nextspark doctor
 */

import chalk from 'chalk'
import { checkDependencies } from './checks/dependencies.js'
import { checkConfigs } from './checks/config.js'
import { checkDatabase } from './checks/database.js'
import { checkImports } from './checks/imports.js'

/**
 * Result of a health check
 */
export interface HealthCheckResult {
  /** Name of the check */
  name: string
  /** Status of the check */
  status: 'pass' | 'warn' | 'fail'
  /** Human-readable message */
  message: string
  /** Suggested fix for warnings/failures */
  fix?: string
}

/**
 * Status icons for display
 */
const STATUS_ICONS = {
  pass: chalk.green('\u2713'),
  warn: chalk.yellow('\u26A0'),
  fail: chalk.red('\u2717'),
} as const

/**
 * Format a health check result for console output
 */
function formatResult(result: HealthCheckResult): string {
  const icon = STATUS_ICONS[result.status]
  const nameColor = result.status === 'fail' ? chalk.red : result.status === 'warn' ? chalk.yellow : chalk.white
  const name = nameColor(result.name.padEnd(18))
  const message = chalk.gray(result.message)

  let output = `${icon} ${name} ${message}`

  // Add fix suggestion on a new line for warnings and failures
  if (result.fix && result.status !== 'pass') {
    output += `\n${' '.repeat(22)}${chalk.cyan('\u2192')} ${chalk.cyan(result.fix)}`
  }

  return output
}

/**
 * Display the health check header
 */
function showHeader(): void {
  console.log('')
  console.log(chalk.cyan('\uD83E\uDE7A NextSpark Health Check'))
  console.log('')
}

/**
 * Display the health check summary
 */
function showSummary(results: HealthCheckResult[]): void {
  const passed = results.filter(r => r.status === 'pass').length
  const warnings = results.filter(r => r.status === 'warn').length
  const failed = results.filter(r => r.status === 'fail').length

  console.log('')
  console.log(chalk.gray('-'.repeat(50)))

  const summary = [
    chalk.green(`${passed} passed`),
    warnings > 0 ? chalk.yellow(`${warnings} warning${warnings > 1 ? 's' : ''}`) : null,
    failed > 0 ? chalk.red(`${failed} failed`) : null,
  ].filter(Boolean).join(', ')

  console.log(`Summary: ${summary}`)
  console.log('')

  // Exit code based on results
  if (failed > 0) {
    process.exitCode = 1
  }
}

/**
 * Run all health checks and return the results
 */
export async function runHealthCheck(): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = []

  // Run checks in sequence
  const checks = [
    { name: 'Dependencies', fn: checkDependencies },
    { name: 'Configuration', fn: checkConfigs },
    { name: 'Database', fn: checkDatabase },
    { name: 'Imports', fn: checkImports },
  ]

  for (const check of checks) {
    try {
      const result = await check.fn()
      results.push(result)
    } catch (error) {
      results.push({
        name: check.name,
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        fix: 'Check the error message and try again',
      })
    }
  }

  return results
}

/**
 * Run the health check command with formatted output
 */
export async function runDoctorCommand(): Promise<void> {
  showHeader()

  const results = await runHealthCheck()

  // Display each result
  for (const result of results) {
    console.log(formatResult(result))
  }

  showSummary(results)
}

// Run if executed directly
const isDirectExecution = process.argv[1]?.includes('doctor') ||
                          process.argv.includes('doctor')

if (isDirectExecution && typeof require !== 'undefined') {
  runDoctorCommand().catch((error: Error) => {
    console.error(chalk.red('An unexpected error occurred:'), error.message)
    process.exit(1)
  })
}
