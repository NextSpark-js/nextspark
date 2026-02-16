/**
 * Project Manager
 *
 * Manages generated studio projects: creation, file listing,
 * dev server lifecycle. Singleton state shared across API routes.
 */

import { spawn, type ChildProcess } from 'child_process'
import { readdir, readFile, writeFile, stat, mkdir, symlink } from 'fs/promises'
import path from 'path'
import { existsSync, readFileSync } from 'fs'
import { randomBytes } from 'crypto'
import pg from 'pg'
import type { WizardConfig } from '@nextsparkjs/studio'
import { generateProjectDirect, resolveTemplatesDir } from './project-generator'

// All generated projects live here
const PROJECTS_ROOT = path.resolve(process.cwd(), '../../studio-projects')

// Track running dev servers
const runningServers = new Map<string, { process: ChildProcess; port: number }>()

// Track current project slug
let currentProject: string | null = null

export function getProjectsRoot() {
  return PROJECTS_ROOT
}

export function getProjectPath(slug: string) {
  return path.join(PROJECTS_ROOT, slug)
}

export function getCurrentProject() {
  return currentProject
}

export function setCurrentProject(slug: string) {
  currentProject = slug
}

/**
 * Generate a project directly from bundled templates.
 * Replaces the old npx create-nextspark-app subprocess approach.
 */
export async function generateProject(
  slug: string,
  wizardConfig: WizardConfig,
  onData: (line: string) => void
): Promise<void> {
  const templatesDir = resolveTemplatesDir()

  onData(`[studio] Generating project "${slug}" directly from templates`)
  onData(`[studio] Templates: ${templatesDir}`)

  await generateProjectDirect(slug, wizardConfig, {
    projectsRoot: PROJECTS_ROOT,
    templatesDir,
  }, (step, detail) => {
    onData(`[studio] ${step}${detail ? ': ' + detail : ''}`)
  })

  setCurrentProject(slug)
}

/**
 * List files in a project directory recursively
 */
export async function listProjectFiles(
  slug: string,
  subdir = ''
): Promise<FileNode[]> {
  const base = path.join(getProjectPath(slug), subdir)

  if (!existsSync(base)) {
    return []
  }

  const SKIP = new Set([
    'node_modules', '.next', '.git', '.nextspark',
    '.turbo', 'dist', '.DS_Store', '.env.local',
  ])

  const entries = await readdir(base, { withFileTypes: true })
  const result: FileNode[] = []

  // Sort: directories first, then files
  const sorted = entries
    .filter((e) => !SKIP.has(e.name) && !e.name.startsWith('.env.local'))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1
      if (!a.isDirectory() && b.isDirectory()) return 1
      return a.name.localeCompare(b.name)
    })

  for (const entry of sorted) {
    const relativePath = subdir ? `${subdir}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      const children = await listProjectFiles(slug, relativePath)
      result.push({
        name: entry.name,
        path: relativePath,
        type: 'directory',
        children,
      })
    } else {
      result.push({
        name: entry.name,
        path: relativePath,
        type: 'file',
      })
    }
  }

  return result
}

/**
 * Read a file from a project
 */
export async function readProjectFile(
  slug: string,
  filePath: string
): Promise<string> {
  const fullPath = path.join(getProjectPath(slug), filePath)

  // Security: prevent path traversal
  const resolved = path.resolve(fullPath)
  const projectRoot = path.resolve(getProjectPath(slug))
  if (!resolved.startsWith(projectRoot)) {
    throw new Error('Access denied: path traversal detected')
  }

  const stats = await stat(fullPath)
  if (stats.size > 500_000) {
    return '// File too large to display'
  }

  return readFile(fullPath, 'utf-8')
}

// Track which projects have had their DB set up
const dbSetupDone = new Set<string>()

/**
 * Parse a DATABASE_URL into its components
 */
function parseDbUrl(url: string): {
  user: string
  password: string
  host: string
  port: string
  database: string
  params: string
} {
  // postgresql://user:password@host:port/database?params
  const match = url.match(
    /^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)(\?.+)?$/
  )
  if (!match) throw new Error('Invalid DATABASE_URL format')
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5],
    params: match[6] || '',
  }
}

/**
 * Set up a PostgreSQL database for a generated project.
 *
 * 1. Creates database `studio_<slug>` on the same PostgreSQL server
 * 2. Writes a proper .env to the project with real credentials
 * 3. Runs `pnpm db:migrate` to set up tables and seed data
 */
export async function setupProjectDatabase(
  slug: string,
  previewPort: number,
  onLog?: (line: string) => void,
  externalHostname?: string
): Promise<{ ok: boolean; error?: string }> {
  const log = onLog || (() => {})

  if (dbSetupDone.has(slug)) {
    log('[db] Database already set up for this project')
    return { ok: true }
  }

  const projectPath = getProjectPath(slug)
  if (!existsSync(projectPath)) {
    return { ok: false, error: 'Project not found' }
  }

  // Get the studio's DATABASE_URL
  const studioDbUrl = process.env.DATABASE_URL
  if (!studioDbUrl) {
    return { ok: false, error: 'Studio DATABASE_URL not configured' }
  }

  let dbInfo: ReturnType<typeof parseDbUrl>
  try {
    dbInfo = parseDbUrl(studioDbUrl.replace(/^["']|["']$/g, ''))
  } catch {
    return { ok: false, error: 'Failed to parse studio DATABASE_URL' }
  }

  const dbName = `studio_${slug.replace(/-/g, '_')}`
  // Ensure sslmode=disable for Docker PostgreSQL (no SSL support)
  let params = dbInfo.params
  if (!params.includes('sslmode')) {
    params = params ? `${params}&sslmode=disable` : '?sslmode=disable'
  }
  const projectDbUrl = `postgresql://${dbInfo.user}:${dbInfo.password}@${dbInfo.host}:${dbInfo.port}/${dbName}${params}`

  // Step 1: Create the database using pg Client
  log(`[db] Creating database "${dbName}"...`)
  try {
    const adminClient = new pg.Client({
      user: dbInfo.user,
      password: decodeURIComponent(dbInfo.password),
      host: dbInfo.host,
      port: parseInt(dbInfo.port, 10),
      database: dbInfo.database,
      // Default to no SSL for Docker/internal connections.
      // Only enable SSL if explicitly required in the connection string.
      ssl: dbInfo.params.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
    })
    await adminClient.connect()

    // Check if database already exists
    const check = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    )

    if (check.rows.length === 0) {
      // CREATE DATABASE can't use parameterized queries, but dbName is sanitized (only alphanumeric + underscore)
      await adminClient.query(`CREATE DATABASE "${dbName}"`)
      log(`[db] Database "${dbName}" created`)
    } else {
      log(`[db] Database "${dbName}" already exists`)
    }

    await adminClient.end()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!msg.includes('already exists')) {
      return { ok: false, error: `Failed to create database: ${msg}` }
    }
    log(`[db] Database "${dbName}" already exists`)
  }

  // Step 2: Write proper .env
  log('[db] Configuring project environment...')
  const authSecret = randomBytes(32).toString('base64')

  // Read the project's active theme from existing .env
  let activeTheme = slug
  try {
    const existingEnv = readFileSync(path.join(projectPath, '.env'), 'utf-8')
    const themeMatch = existingEnv.match(/NEXT_PUBLIC_ACTIVE_THEME="?([^"\n]+)"?/)
    if (themeMatch) activeTheme = themeMatch[1]
  } catch {
    // Use slug as fallback theme name
  }

  const host = externalHostname || 'localhost'
  const appUrl = `http://${host}:${previewPort}`

  const envContent = `# NextSpark Environment Configuration
# Auto-configured by NextSpark Studio

# DATABASE
DATABASE_URL="${projectDbUrl}"

# AUTHENTICATION
BETTER_AUTH_SECRET="${authSecret}"
BETTER_AUTH_URL="${appUrl}"

# THEME
NEXT_PUBLIC_ACTIVE_THEME="${activeTheme}"

# APPLICATION
NEXT_PUBLIC_APP_URL="${appUrl}"
NODE_ENV="development"

# STRIPE (disabled for preview)
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""

# EMAIL (disabled for preview)
RESEND_API_KEY=""
`

  await writeFile(path.join(projectPath, '.env'), envContent, 'utf-8')
  log('[db] Environment configured')

  // Step 3: Run migrations
  log('[db] Running database migrations...')
  try {
    const migrateResult = await new Promise<number>((resolve, reject) => {
      const child = spawn('pnpm', ['db:migrate'], {
        cwd: projectPath,
        shell: true,
        env: {
          ...process.env,
          DATABASE_URL: projectDbUrl,
          NEXT_PUBLIC_ACTIVE_THEME: activeTheme,
          FORCE_COLOR: '0',
        },
        stdio: 'pipe',
      })

      let output = ''
      child.stdout?.on('data', (data: Buffer) => {
        const text = data.toString().trim()
        if (text) {
          output += text + '\n'
          log(`[migrate] ${text.split('\n').pop()}`)
        }
      })

      child.stderr?.on('data', (data: Buffer) => {
        const text = data.toString().trim()
        if (text) output += text + '\n'
      })

      child.on('error', reject)
      child.on('close', (code) => resolve(code ?? 1))
    })

    if (migrateResult !== 0) {
      return { ok: false, error: 'Migration failed' }
    }

    log('[db] Migrations completed successfully')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Migration error: ${msg}` }
  }

  dbSetupDone.add(slug)
  log('[db] Database setup complete!')
  return { ok: true }
}

/**
 * Start pnpm dev on a generated project
 * @param slug - Project slug
 * @param preferredPort - Optional port (from setupProjectDatabase) to keep .env in sync
 */
export function startPreview(slug: string, preferredPort?: number): Promise<number> {
  return new Promise(async (resolve, reject) => {
    const existing = runningServers.get(slug)
    if (existing) {
      resolve(existing.port)
      return
    }

    const projectPath = getProjectPath(slug)
    const port = preferredPort || (5500 + Math.floor(Math.random() * 100))

    // Ensure @nextsparkjs/registries symlink exists before starting dev server
    try {
      const registriesTarget = path.join(projectPath, '.nextspark', 'registries')
      const registriesLink = path.join(projectPath, 'node_modules', '@nextsparkjs', 'registries')
      if (existsSync(registriesTarget) && !existsSync(registriesLink)) {
        await mkdir(path.dirname(registriesLink), { recursive: true })
        await symlink(registriesTarget, registriesLink, 'junction')
      }
    } catch {
      // Non-fatal — webpack alias should handle it
    }

    // Ensure next-intl config stubs are patched before starting dev server.
    // Webpack 5 self-referencing imports bypass resolve.alias and NMR plugins,
    // so we patch the stub files directly to re-export from @nextsparkjs/core/i18n.
    try {
      const nextIntlBase = path.join(projectPath, 'node_modules/next-intl/dist/esm')
      const configRedirect = `export { default } from '@nextsparkjs/core/i18n';\n`
      for (const env of ['production', 'development']) {
        const stubPath = path.join(nextIntlBase, env, 'config.js')
        if (existsSync(stubPath)) {
          const content = readFileSync(stubPath, 'utf-8')
          if (content.includes("Couldn't find next-intl config")) {
            await writeFile(stubPath, configRedirect, 'utf-8')
          }
        }
      }
    } catch {
      // Non-fatal — NMR plugin in next.config.mjs is fallback
    }

    // Read the project's .env and pass values explicitly to the child process.
    // Critical: The nextspark CLI uses dotenvx which traverses parent directories
    // to find .env files. The Studio's parent .env would override the project's .env.
    // Also: Next.js won't override process.env vars with .env file values.
    // Solution: Read project .env, strip parent vars, set explicitly in child env.
    const projectEnvOverrides: Record<string, string> = {}
    const envVarsToIsolate = [
      'DATABASE_URL', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL',
      'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_ACTIVE_THEME',
      'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      'RESEND_API_KEY', 'NODE_ENV',
    ]

    try {
      const envContent = readFileSync(path.join(projectPath, '.env'), 'utf-8')
      for (const line of envContent.split('\n')) {
        const match = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?\s*$/)
        if (match && envVarsToIsolate.includes(match[1])) {
          projectEnvOverrides[match[1]] = match[2]
        }
      }
    } catch {
      // .env not found - continue without overrides
    }

    // Prevent dotenvx from traversing parent directories and finding the Studio's .env
    // DOTENV_CONFIG_PATH forces dotenvx to use only the project's .env
    projectEnvOverrides['DOTENV_CONFIG_PATH'] = path.join(projectPath, '.env')

    const child = spawn('pnpm', ['dev'], {
      cwd: projectPath,
      shell: true,
      env: {
        ...process.env,
        ...projectEnvOverrides,
        PORT: String(port),
        HOSTNAME: '0.0.0.0', // Listen on all interfaces (required in Docker)
        FORCE_COLOR: '0',
      },
      stdio: 'pipe',
    })

    runningServers.set(slug, { process: child, port })

    // Wait for "Ready" message
    let resolved = false
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        // Resolve anyway after 15s - server might be ready
        resolve(port)
      }
    }, 15000)

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString()
      if (!resolved && (text.includes('Ready') || text.includes('localhost'))) {
        resolved = true
        clearTimeout(timeout)
        resolve(port)
      }
    })

    child.on('error', (err) => {
      runningServers.delete(slug)
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        reject(err)
      }
    })

    child.on('close', () => {
      runningServers.delete(slug)
    })
  })
}

/**
 * Stop a running preview server
 */
export function stopPreview(slug: string) {
  const server = runningServers.get(slug)
  if (server) {
    server.process.kill()
    runningServers.delete(slug)
  }
}

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}
