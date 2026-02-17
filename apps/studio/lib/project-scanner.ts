/**
 * Project Scanner
 *
 * Lightweight scanner that reads entity configs, app config, and page definitions
 * from a generated project directory. Used to update session state after chat
 * modifications so the Config/Entity preview tabs reflect changes.
 *
 * Uses simple regex/string parsing (not full TypeScript AST).
 */

import { readdir, readFile, stat } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

interface ScannedEntity {
  slug: string
  names?: { singular: string; plural: string }
  description?: string
  fields: Array<{ name: string; type: string }>
}

interface ScannedPage {
  pageName: string
  route: string
}

interface ScannedResult {
  entities?: ScannedEntity[]
  pages?: ScannedPage[]
  wizardConfig?: Record<string, unknown>
}

/**
 * Extract a string value from a TS/JS object literal using regex.
 * Handles both quoted strings and unquoted identifiers.
 */
function extractStringProp(content: string, key: string): string | undefined {
  // Match: key: 'value' or key: "value"
  const match = content.match(new RegExp(`${key}\\s*:\\s*['"]([^'"]+)['"]`))
  return match?.[1]
}

/**
 * Scan a single entity config file and extract key metadata.
 */
async function scanEntityConfig(configPath: string): Promise<ScannedEntity | null> {
  try {
    const content = await readFile(configPath, 'utf-8')

    const slug = extractStringProp(content, 'slug')
    if (!slug) return null

    const singular = extractStringProp(content, 'singular')
    const plural = extractStringProp(content, 'plural')

    // Extract fields from the fields array — look for field definitions
    const fields: Array<{ name: string; type: string }> = []

    // Match field objects: { name: 'fieldName', type: 'fieldType', ... }
    const fieldRegex = /\{\s*name\s*:\s*['"]([^'"]+)['"]\s*,\s*type\s*:\s*['"]([^'"]+)['"]/g
    let fieldMatch
    while ((fieldMatch = fieldRegex.exec(content)) !== null) {
      fields.push({ name: fieldMatch[1], type: fieldMatch[2] })
    }

    // If no inline fields found, try reading the companion .fields.ts file
    if (fields.length === 0) {
      const fieldsPath = configPath.replace('.config.ts', '.fields.ts')
      if (existsSync(fieldsPath)) {
        try {
          const fieldsContent = await readFile(fieldsPath, 'utf-8')
          let fm
          const fRegex = /\{\s*name\s*:\s*['"]([^'"]+)['"]\s*,\s*type\s*:\s*['"]([^'"]+)['"]/g
          while ((fm = fRegex.exec(fieldsContent)) !== null) {
            fields.push({ name: fm[1], type: fm[2] })
          }
        } catch {
          // Best-effort
        }
      }
    }

    return {
      slug,
      names: singular && plural ? { singular, plural } : undefined,
      fields,
    }
  } catch {
    return null
  }
}

/**
 * Scan the project's app.config.ts for wizard-level configuration values.
 */
async function scanAppConfig(projectDir: string, themeName: string): Promise<Record<string, unknown> | undefined> {
  const configPath = path.join(projectDir, 'contents', 'themes', themeName, 'config', 'app.config.ts')
  if (!existsSync(configPath)) return undefined

  try {
    const content = await readFile(configPath, 'utf-8')

    const result: Record<string, unknown> = {}

    // Extract app name
    const appName = extractStringProp(content, 'name')
    if (appName) result.projectName = appName

    // Extract team mode
    const teamMode = content.match(/mode\s*:\s*['"]([^'"]+)['"]/)
    if (teamMode) result.teamMode = teamMode[1]

    // Extract default locale
    const defaultLocale = extractStringProp(content, 'defaultLocale')
    if (defaultLocale) result.defaultLocale = defaultLocale

    // Extract supported locales array
    const localesMatch = content.match(/supportedLocales\s*:\s*\[([^\]]+)\]/)
    if (localesMatch) {
      const locales = localesMatch[1].match(/['"]([^'"]+)['"]/g)
      if (locales) {
        result.supportedLocales = locales.map(l => l.replace(/['"]/g, ''))
      }
    }

    // Extract registration mode
    const regMode = content.match(/registration\s*:\s*\{[^}]*mode\s*:\s*['"]([^'"]+)['"]/)
    if (regMode) result.registrationMode = regMode[1]

    return Object.keys(result).length > 0 ? result : undefined
  } catch {
    return undefined
  }
}

/**
 * Scan all entities in the project's theme directory.
 */
async function scanEntities(projectDir: string, themeName: string): Promise<ScannedEntity[]> {
  const entitiesDir = path.join(projectDir, 'contents', 'themes', themeName, 'entities')
  if (!existsSync(entitiesDir)) return []

  const entities: ScannedEntity[] = []

  try {
    const entries = await readdir(entitiesDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const configPath = path.join(entitiesDir, entry.name, `${entry.name}.config.ts`)
      if (!existsSync(configPath)) continue

      const entity = await scanEntityConfig(configPath)
      if (entity) {
        entities.push(entity)
      }
    }
  } catch {
    // Best-effort
  }

  return entities
}

/**
 * Scan pages from the pages entity (page builder content stored in DB).
 * Since pages are DB-driven, we can only detect the entity exists — not the actual pages.
 * We return the pages entity info so the UI knows pages are available.
 */
async function scanPages(projectDir: string, themeName: string): Promise<ScannedPage[]> {
  // Pages are stored in the database, not as files.
  // We check if the pages entity config exists to confirm page support.
  const pagesConfigPath = path.join(
    projectDir, 'contents', 'themes', themeName, 'entities', 'pages', 'pages.config.ts'
  )

  if (!existsSync(pagesConfigPath)) return []

  // Return a placeholder indicating the pages entity exists
  return [{ pageName: 'Pages', route: '/' }]
}

/**
 * Scan the project state and return updated StudioResult fields.
 * This is called after chat modifications to sync session state.
 */
export async function scanProjectState(
  projectDir: string,
  themeName: string
): Promise<ScannedResult> {
  const [entities, pages, wizardConfig] = await Promise.all([
    scanEntities(projectDir, themeName),
    scanPages(projectDir, themeName),
    scanAppConfig(projectDir, themeName),
  ])

  const result: ScannedResult = {}

  if (entities.length > 0) result.entities = entities
  if (pages.length > 0) result.pages = pages
  if (wizardConfig) result.wizardConfig = wizardConfig

  return result
}
