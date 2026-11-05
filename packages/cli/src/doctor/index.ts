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

import chalk from '../utils/colors.js'
import { checkDependencies } from './checks/dependencies.js'
import { checkConfigs } from './checks/config.js'
import { checkDatabase } from './checks/database.js'
import { checkAuthSchema } from './checks/auth-schema.js'
import { checkRlsRuntime } from './checks/rls-runtime.js'
import { checkAppRole } from './checks/app-role.js'
import { checkImports } from './checks/imports.js'
import { checkDuplicateDependencies, checkZodBelowCore } from './checks/lockfile.js'
import { checkQueryClients } from './checks/query-client.js'
import { checkNextThemesImports } from './checks/next-themes.js'
import { checkQueryHooksWithoutProvider } from './checks/query-hooks.js'
import { checkHoisting } from './checks/hoisting.js'

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
  /** Stable code of the finding (NS_...), also at the start of the message */
  code?: string
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
 * Format a health check result as the lines to print
 */
function formatResult(result: HealthCheckResult): string[] {
  const icon = STATUS_ICONS[result.status]
  const nameColor = result.status === 'fail' ? chalk.red : result.status === 'warn' ? chalk.yellow : chalk.white
  const name = nameColor(result.name.padEnd(18))
  const message = chalk.gray(result.message)

  const lines = [`${icon} ${name} ${message}`]

  // The fix goes on a line of its own: one console call per line, because the output guard quotes a call that holds a newline
  if (result.fix && result.status !== 'pass') {
    lines.push(`${' '.repeat(22)}${chalk.cyan('\u2192')} ${chalk.cyan(result.fix)}`)
  }

  return lines
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
    { name: 'Auth schema', fn: () => checkAuthSchema() },
    { name: 'Row-level security', fn: () => checkRlsRuntime() },
    { name: 'App role', fn: () => checkAppRole() },
    { name: 'Imports', fn: checkImports },
    { name: 'Duplicates', fn: checkDuplicateDependencies },
    { name: 'Zod', fn: checkZodBelowCore },
    { name: 'Query caches', fn: checkQueryClients },
    { name: 'Theme imports', fn: checkNextThemesImports },
    { name: 'React Query providers', fn: checkQueryHooksWithoutProvider },
    { name: 'Hoisting', fn: () => checkHoisting() },
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
    for (const line of formatResult(result)) console.log(line)
  }

  showSummary(results)
}
