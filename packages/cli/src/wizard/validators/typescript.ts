/**
 * TypeScript Validator
 *
 * Validates TypeScript compilation for the generated theme.
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs-extra'
import type { ValidationError, ValidationWarning } from './index.js'

const execAsync = promisify(exec)

/**
 * Parse TypeScript compiler output to extract errors
 */
function parseTypeScriptErrors(output: string, themePath: string): ValidationError[] {
  const errors: ValidationError[] = []
  const lines = output.split('\n')

  for (const line of lines) {
    // Match TypeScript error format: file(line,col): error TSxxxx: message
    const match = line.match(/^(.+)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/)
    if (match) {
      const [, file, lineNum, col, code, message] = match
      errors.push({
        type: 'typescript',
        message: `${code}: ${message} (line ${lineNum}, col ${col})`,
        file: file.replace(themePath, '').replace(/^[/\\]/, ''),
      })
      continue
    }

    // Match alternative format: file:line:col - error TSxxxx: message
    const altMatch = line.match(/^(.+):(\d+):(\d+)\s*-\s*error\s+(TS\d+):\s*(.+)$/)
    if (altMatch) {
      const [, file, lineNum, col, code, message] = altMatch
      errors.push({
        type: 'typescript',
        message: `${code}: ${message} (line ${lineNum}, col ${col})`,
        file: file.replace(themePath, '').replace(/^[/\\]/, ''),
      })
    }
  }

  return errors
}

/**
 * Validate TypeScript compilation for the generated theme
 *
 * Runs `tsc --noEmit` to check for type errors without generating output files.
 *
 * @param themePath - Absolute path to the theme directory
 * @returns Object containing errors and warnings from compilation
 */
export async function validateTypeScript(
  themePath: string
): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  // Check if tsconfig.json exists in project root or theme
  const projectRoot = process.cwd()
  const projectTsConfig = path.join(projectRoot, 'tsconfig.json')
  const themeTsConfig = path.join(themePath, 'tsconfig.json')

  let tsConfigPath: string | null = null
  if (await fs.pathExists(themeTsConfig)) {
    tsConfigPath = themeTsConfig
  } else if (await fs.pathExists(projectTsConfig)) {
    tsConfigPath = projectTsConfig
  }

  if (!tsConfigPath) {
    warnings.push({
      type: 'typescript',
      message: 'No tsconfig.json found. TypeScript validation skipped.',
    })
    return { errors, warnings }
  }

  try {
    // Run tsc --noEmit to check for type errors
    const tscPath = path.join(projectRoot, 'node_modules', '.bin', 'tsc')
    const useLocalTsc = await fs.pathExists(tscPath)

    const command = useLocalTsc
      ? `"${tscPath}" --noEmit --project "${tsConfigPath}"`
      : `npx tsc --noEmit --project "${tsConfigPath}"`

    await execAsync(command, {
      cwd: projectRoot,
      timeout: 120000, // 2 minute timeout
    })

    // If we get here, compilation succeeded
  } catch (error: unknown) {
    // TypeScript exits with non-zero on errors
    if (error && typeof error === 'object' && 'stdout' in error) {
      const execError = error as { stdout?: string; stderr?: string; code?: number }
      const output = execError.stdout || execError.stderr || ''

      // Parse errors from output
      const parsedErrors = parseTypeScriptErrors(output, themePath)
      if (parsedErrors.length > 0) {
        errors.push(...parsedErrors)
      } else if (output.trim()) {
        // If we couldn't parse but there's output, add generic error
        errors.push({
          type: 'typescript',
          message: `TypeScript compilation failed: ${output.slice(0, 500)}`,
        })
      }
    } else if (error instanceof Error) {
      // Handle execution errors (e.g., tsc not found)
      if (error.message.includes('ENOENT') || error.message.includes('not found')) {
        warnings.push({
          type: 'typescript',
          message: 'TypeScript compiler not found. Run "npm install" first.',
        })
      } else {
        errors.push({
          type: 'typescript',
          message: `TypeScript validation failed: ${error.message}`,
        })
      }
    }
  }

  return { errors, warnings }
}
