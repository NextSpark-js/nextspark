/**
 * Entities API Route
 *
 * POST /api/entities — Apply entity definitions to a generated project
 *
 * Writes entity config, fields, migrations, and messages files.
 * Then rebuilds registries so the project picks up changes.
 */

import { getProjectPath } from '@/lib/project-manager'
import { existsSync, readFileSync } from 'fs'
import { writeFile, mkdir } from 'fs/promises'
import { execSync } from 'child_process'
import path from 'path'
import { requireSession } from '@/lib/auth-helpers'
import {
  generateEntityConfig,
  generateEntityFields,
  generateMigrationSql,
  generateMessages,
} from '@/lib/entity-file-generator'
import type { EntityDefinition } from '@nextsparkjs/studio'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  try { await requireSession() } catch (r) { return r as Response }

  const body = await request.json()
  const { slug, entities } = body as { slug?: string; entities?: EntityDefinition[] }

  if (!slug || !entities || !Array.isArray(entities)) {
    return Response.json({ error: 'slug and entities array are required' }, { status: 400 })
  }

  const projectPath = getProjectPath(slug)
  if (!existsSync(projectPath)) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  // Determine the active theme from the project's .env
  let activeTheme = slug
  try {
    const envContent = readFileSync(path.join(projectPath, '.env'), 'utf-8')
    const themeMatch = envContent.match(/NEXT_PUBLIC_ACTIVE_THEME="?([^"\n]+)"?/)
    if (themeMatch) activeTheme = themeMatch[1]
  } catch {
    // fallback to slug
  }

  const themePath = path.join(projectPath, 'contents', 'themes', activeTheme)
  const results: Array<{ entity: string; files: string[] }> = []

  for (const entity of entities) {
    const entityDir = path.join(themePath, 'entities', entity.slug)
    const migrationsDir = path.join(entityDir, 'migrations')
    const messagesDir = path.join(entityDir, 'messages')

    // Create directories
    await mkdir(entityDir, { recursive: true })
    await mkdir(migrationsDir, { recursive: true })
    await mkdir(messagesDir, { recursive: true })

    // Generate and write files
    const configContent = generateEntityConfig(entity)
    const fieldsContent = generateEntityFields(entity)
    const sqlContent = generateMigrationSql(entity)
    const messagesContent = generateMessages(entity)

    const configPath = path.join(entityDir, `${entity.slug}.config.ts`)
    const fieldsPath = path.join(entityDir, `${entity.slug}.fields.ts`)
    const sqlPath = path.join(migrationsDir, `001_${entity.slug}_table.sql`)
    const messagesPath = path.join(messagesDir, 'en.json')

    await Promise.all([
      writeFile(configPath, configContent, 'utf-8'),
      writeFile(fieldsPath, fieldsContent, 'utf-8'),
      writeFile(sqlPath, sqlContent, 'utf-8'),
      writeFile(messagesPath, messagesContent, 'utf-8'),
    ])

    const relBase = `contents/themes/${activeTheme}/entities/${entity.slug}`
    results.push({
      entity: entity.slug,
      files: [
        `${relBase}/${entity.slug}.config.ts`,
        `${relBase}/${entity.slug}.fields.ts`,
        `${relBase}/migrations/001_${entity.slug}_table.sql`,
        `${relBase}/messages/en.json`,
      ],
    })
  }

  // Rebuild registries
  try {
    execSync('npx next-build-registries 2>/dev/null || true', {
      cwd: projectPath,
      timeout: 30000,
      stdio: 'ignore',
    })
  } catch {
    // Registry rebuild is best-effort
  }

  return Response.json({
    ok: true,
    entitiesWritten: results.length,
    entities: results,
  })
}
