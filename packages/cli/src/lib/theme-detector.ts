import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Detects the currently active theme in the project
 * Priority:
 * 1. NEXT_PUBLIC_ACTIVE_THEME environment variable
 * 2. activeTheme in nextspark.config.ts
 * 3. NEXT_PUBLIC_ACTIVE_THEME in .env file
 * 4. Single installed theme (if only one exists)
 * 5. null if cannot be determined
 */
export function detectActiveTheme(): string | null {
  // 1. Environment variable (for CI/CD and development)
  if (process.env.NEXT_PUBLIC_ACTIVE_THEME) {
    return process.env.NEXT_PUBLIC_ACTIVE_THEME
  }

  // 2. nextspark.config.ts (project configuration) - simplified check
  const configPath = join(process.cwd(), 'nextspark.config.ts')
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8')
      // Simple regex to extract activeTheme value
      const match = content.match(/activeTheme\s*:\s*['"]([^'"]+)['"]/)
      if (match) {
        return match[1]
      }
    } catch {
      // Ignore read errors
    }
  }

  // 3. .env file
  const envPath = join(process.cwd(), '.env')
  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, 'utf-8')
      const match = content.match(/NEXT_PUBLIC_ACTIVE_THEME=(.+)/)
      if (match) {
        return match[1].trim()
      }
    } catch {
      // Ignore read errors
    }
  }

  // 4. Single installed theme
  const themesDir = join(process.cwd(), 'contents', 'themes')
  if (existsSync(themesDir)) {
    try {
      const themes = readdirSync(themesDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
      if (themes.length === 1) {
        return themes[0]
      }
    } catch {
      // Ignore read errors
    }
  }

  // 5. Cannot determine
  return null
}

/**
 * Returns a list of all available themes in the project
 */
export function getAvailableThemes(): string[] {
  const themesDir = join(process.cwd(), 'contents', 'themes')
  if (!existsSync(themesDir)) {
    return []
  }

  try {
    return readdirSync(themesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } catch {
    return []
  }
}
