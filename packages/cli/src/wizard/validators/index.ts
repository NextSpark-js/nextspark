/**
 * Validators Index
 *
 * Post-generation validation for NextSpark wizard.
 * Validates the generated theme structure, TypeScript compilation, and i18n completeness.
 */

import type { WizardConfig } from '../types.js'
import { validateTypeScript } from './typescript.js'
import { validateRequiredFiles } from './files.js'
import { validateI18n } from './i18n.js'

/**
 * Represents a validation error that must be fixed
 */
export interface ValidationError {
  /** Category of the error (typescript, files, i18n, etc.) */
  type: string
  /** Human-readable error message */
  message: string
  /** Optional file path related to the error */
  file?: string
}

/**
 * Represents a validation warning that should be reviewed
 */
export interface ValidationWarning {
  /** Category of the warning */
  type: string
  /** Human-readable warning message */
  message: string
}

/**
 * Result of the validation process
 */
export interface ValidationResult {
  /** Whether validation passed with no errors */
  valid: boolean
  /** List of errors that must be fixed */
  errors: ValidationError[]
  /** List of warnings that should be reviewed */
  warnings: ValidationWarning[]
}

/**
 * Validate the generated theme structure and content
 *
 * Runs all validation checks:
 * 1. File structure validation - checks required directories and files
 * 2. TypeScript validation - runs tsc --noEmit to check for type errors
 * 3. i18n validation - verifies translation completeness
 *
 * @param themePath - Absolute path to the generated theme directory
 * @param config - Wizard configuration used during generation
 * @returns ValidationResult with errors and warnings
 *
 * @example
 * ```typescript
 * const result = await validateGeneratedTheme(
 *   '/path/to/contents/themes/my-app',
 *   wizardConfig
 * )
 *
 * if (!result.valid) {
 *   console.error('Validation failed:', result.errors)
 * }
 * ```
 */
export async function validateGeneratedTheme(
  themePath: string,
  config: WizardConfig
): Promise<ValidationResult> {
  const allErrors: ValidationError[] = []
  const allWarnings: ValidationWarning[] = []

  // 1. Validate file structure first (fast check)
  const filesResult = await validateRequiredFiles(themePath, config)
  allErrors.push(...filesResult.errors)
  allWarnings.push(...filesResult.warnings)

  // 2. Validate i18n completeness
  const i18nResult = await validateI18n(themePath, config)
  allErrors.push(...i18nResult.errors)
  allWarnings.push(...i18nResult.warnings)

  // 3. Validate TypeScript (slower, run last)
  // Only run if no critical file structure errors
  const hasCriticalFileErrors = filesResult.errors.some(
    e => e.message.includes('Theme directory not found') ||
         e.message.includes('Required directory missing')
  )

  if (!hasCriticalFileErrors) {
    const tsResult = await validateTypeScript(themePath)
    allErrors.push(...tsResult.errors)
    allWarnings.push(...tsResult.warnings)
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  }
}

// Re-export individual validators for granular usage
export { validateTypeScript } from './typescript.js'
export { validateRequiredFiles } from './files.js'
export { validateI18n } from './i18n.js'
