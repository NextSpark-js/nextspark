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
  const isRemote = !host.startsWith('localhost') && !host.startsWith('127.')
  // Remote: proxy through Caddy on port 80 using basePath /p/{port}
  // Local: direct access to dev server port
  const appUrl = isRemote
    ? `http://${host}/p/${previewPort}`
    : `http://${host}:${previewPort}`

  // Better Auth uses baseURL to build its internal router basePath via:
  //   const basePath = new URL(ctx.baseURL).pathname
  // When Next.js basePath is active (e.g., /p/5556), Next.js strips it from
  // request.url before the route handler sees it. So Better Auth must NOT
  // include the Next.js basePath in its baseURL — otherwise its router expects
  // /p/5556/api/auth/... but receives /api/auth/... (already stripped) → 404.
  // NEXT_PUBLIC_APP_URL keeps the full external URL for client-side use.
  const betterAuthUrl = isRemote
    ? `http://${host}`
    : appUrl

  const envContent = `# NextSpark Environment Configuration
# Auto-configured by NextSpark Studio

# DATABASE
DATABASE_URL="${projectDbUrl}"

# AUTHENTICATION
BETTER_AUTH_SECRET="${authSecret}"
BETTER_AUTH_URL="${betterAuthUrl}"

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

    // Determine if running behind Caddy (remote/production) or direct (local dev).
    // Remote: preview is proxied through Caddy on port 80 at /p/{port}/
    // Local: preview is accessed directly at http://localhost:{port}
    let previewHost = 'localhost'
    try {
      const envContent = readFileSync(path.join(projectPath, '.env'), 'utf-8')
      const urlMatch = envContent.match(/NEXT_PUBLIC_APP_URL="http:\/\/([^/:"]+)/)
      if (urlMatch) previewHost = urlMatch[1]
    } catch { /* use localhost default */ }

    const isRemote = !previewHost.startsWith('localhost') && !previewHost.startsWith('127.')
    const appUrl = isRemote
      ? `http://${previewHost}/p/${port}`
      : `http://${previewHost}:${port}`

    // Sync .env auth/app URLs with the actual preview port/path.
    // BETTER_AUTH_URL must NOT include the Next.js basePath — see setupProjectDatabase comment.
    // NEXT_PUBLIC_APP_URL keeps the full external URL for client-side use.
    const betterAuthUrl = isRemote
      ? `http://${previewHost}`
      : appUrl
    try {
      const envPath = path.join(projectPath, '.env')
      if (existsSync(envPath)) {
        let envContent = readFileSync(envPath, 'utf-8')
        // Replace the full URL values (handles both port and proxy formats)
        envContent = envContent.replace(
          /BETTER_AUTH_URL="[^"]+"/,
          `BETTER_AUTH_URL="${betterAuthUrl}"`
        )
        envContent = envContent.replace(
          /NEXT_PUBLIC_APP_URL="[^"]+"/,
          `NEXT_PUBLIC_APP_URL="${appUrl}"`
        )
        await writeFile(envPath, envContent, 'utf-8')
      }
    } catch {
      // Non-fatal — auth may fail but preview will still work
    }

    // When running behind Caddy (remote), ensure next.config.mjs reads basePath
    // from NEXT_BASE_PATH env var. The env var is set in the spawn env below.
    // This is more robust than regex-replacing the config file (no race conditions,
    // no cache invalidation needed, works through any config wrapper like withNextIntl).
    if (isRemote) {
      try {
        const nextConfigPath = path.join(projectPath, 'next.config.mjs')
        if (existsSync(nextConfigPath)) {
          let config = readFileSync(nextConfigPath, 'utf-8')
          // One-time patch: add env var support if not already present.
          // New projects from updated templates already have this.
          if (!config.includes('NEXT_BASE_PATH')) {
            // Remove any hardcoded basePath from previous approach
            config = config.replace(/\s*basePath:\s*'\/p\/\d+',?\n?/g, '')
            // Add env var-based basePath after the opening of nextConfig
            config = config.replace(
              'const nextConfig = {',
              `const nextConfig = {\n  ...(process.env.NEXT_BASE_PATH ? { basePath: process.env.NEXT_BASE_PATH } : {}),`
            )
            await writeFile(nextConfigPath, config, 'utf-8')
          }
        }
      } catch {
        // Non-fatal — preview works without basePath, just cookies won't persist in iframe
      }
    }

    // Patch proxy.ts to use basePath in auth fetch calls.
    // The template uses request.nextUrl.origin which doesn't include basePath,
    // causing middleware auth checks to hit Studio instead of the preview.
    if (isRemote) {
      try {
        const proxyPath = path.join(projectPath, 'proxy.ts')
        if (existsSync(proxyPath)) {
          let proxy = readFileSync(proxyPath, 'utf-8')
          if (proxy.includes('baseURL: request.nextUrl.origin,') && !proxy.includes('basePath')) {
            proxy = proxy.replace(
              /baseURL: request\.nextUrl\.origin,/g,
              "baseURL: request.nextUrl.origin + (request.nextUrl.basePath || ''),"
            )
            await writeFile(proxyPath, proxy, 'utf-8')
          }
        }
      } catch {
        // Non-fatal
      }
    }

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

    // Patch .ts dynamic imports in @nextsparkjs/core before dev server starts.
    // The compiled registry.js has `import(`../../messages/${locale}/index.ts`)` which
    // webpack can't parse. Replace .ts → .js in the import paths.
    try {
      const registryFile = path.join(projectPath, 'node_modules/@nextsparkjs/core/dist/lib/translations/registry.js')
      if (existsSync(registryFile)) {
        const content = readFileSync(registryFile, 'utf-8')
        if (content.includes('/index.ts')) {
          await writeFile(registryFile, content.replace(/\/index\.ts/g, '/index.js'), 'utf-8')
        }
      }
    } catch {
      // Non-fatal — NMR plugin in next.config.mjs is fallback
    }

    // Patch auth-client.js for basePath compatibility (needed for proxy setups).
    // Better Auth's withPath() returns baseURL as-is when it has a pathname.
    // Fix: append "/api/auth" to the baseURL so the full auth path is included.
    if (isRemote) {
      try {
        const authClientFile = path.join(projectPath, 'node_modules/@nextsparkjs/core/dist/lib/auth-client.js')
        if (existsSync(authClientFile)) {
          const content = readFileSync(authClientFile, 'utf-8')
          if (content.includes('process.env.NEXT_PUBLIC_APP_URL') && !content.includes('+ "/api/auth"')) {
            const patched = content.replace(
              /baseURL:\s*(process\.env\.NEXT_PUBLIC_APP_URL\s*\|\|\s*["'][^"']+["'])/,
              'baseURL: ($1) + "/api/auth"'
            )
            await writeFile(authClientFile, patched, 'utf-8')
          }
        }
      } catch {
        // Non-fatal
      }
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
      'RESEND_API_KEY',
      // Note: NODE_ENV is NOT included here — we always force 'development' for preview servers
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

    // Build a clean env for the preview process.
    // CRITICAL: Strip __NEXT_PRIVATE_* vars from the Studio's process.env.
    // The Studio runs in standalone mode which sets __NEXT_PRIVATE_STANDALONE_CONFIG
    // containing the Studio's serialized config (basePath: "", output: "standalone").
    // If leaked to the preview's `next dev`, the worker process uses this pre-serialized
    // config instead of evaluating the project's own next.config.mjs — breaking basePath,
    // transpilePackages, remotePatterns, and every other project-specific setting.
    const cleanEnv: Record<string, string | undefined> = {}
    for (const [key, value] of Object.entries(process.env)) {
      if (!key.startsWith('__NEXT_PRIVATE')) {
        cleanEnv[key] = value
      }
    }

    const child = spawn('pnpm', ['dev'], {
      cwd: projectPath,
      shell: true,
      env: {
        ...cleanEnv,
        ...projectEnvOverrides,
        PORT: String(port),
        HOSTNAME: '0.0.0.0', // Listen on all interfaces (required in Docker)
        FORCE_COLOR: '0',
        // Force development mode for preview dev servers.
        // Studio runs with NODE_ENV=production, but `next dev` MUST run with
        // NODE_ENV=development — otherwise it tries to read production-only build
        // artifacts (required-server-files.json, BUILD_ID) and returns 500 on all requests.
        NODE_ENV: 'development',
        // Limit Node.js heap to prevent OOM kills on small VPS instances.
        // Next.js dev server needs ~1.5GB for first compilation of a full project.
        // 512MB/1024MB cause heap OOM during webpack compilation.
        NODE_OPTIONS: '--max-old-space-size=2048',
        // Set basePath for Caddy proxy routing. next.config.mjs reads this env var
        // to prefix all routes with /p/{port}/, keeping preview on the same origin.
        ...(isRemote ? { NEXT_BASE_PATH: `/p/${port}` } : {}),
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
