/**
 * Deploy Manager
 *
 * Server-side module for deploying generated apps to production
 * using PM2 for process management and Caddy for reverse proxying.
 *
 * Port allocation: 6000-6999 range for production deployments
 * (preview uses 5100-5999).
 */

import { spawn } from 'child_process'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { getProjectPath, getProjectsRoot } from './project-manager'

const DEPLOY_PORT_MIN = 6000
const DEPLOY_PORT_MAX = 6999
const REGISTRY_FILE = path.join(getProjectsRoot(), '.deploy-registry.json')

// ── Types ──

export type DeployStep = 'building' | 'starting' | 'routing' | 'done' | 'error'

export interface DeployStatus {
  slug: string
  status: 'deployed' | 'stopped' | 'building' | 'error'
  port?: number
  url?: string
  pm2Name?: string
  deployedAt?: string
  error?: string
}

interface DeployRegistry {
  deployments: Record<string, {
    port: number
    pm2Name: string
    deployedAt: string
    url: string
  }>
}

// ── Registry ──

async function loadRegistry(): Promise<DeployRegistry> {
  try {
    const content = await readFile(REGISTRY_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return { deployments: {} }
  }
}

async function saveRegistry(registry: DeployRegistry): Promise<void> {
  const dir = path.dirname(REGISTRY_FILE)
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
  await writeFile(REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf-8')
}

// ── Port allocation ──

async function allocatePort(): Promise<number> {
  const registry = await loadRegistry()
  const usedPorts = new Set(
    Object.values(registry.deployments).map(d => d.port)
  )

  for (let port = DEPLOY_PORT_MIN; port <= DEPLOY_PORT_MAX; port++) {
    if (!usedPorts.has(port)) {
      return port
    }
  }

  throw new Error('No available ports in deployment range (6000-6999)')
}

// ── Build ──

function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  env?: Record<string, string>
): Promise<{ code: number; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      shell: true,
      env: { ...process.env, ...env, FORCE_COLOR: '0' },
      stdio: 'pipe',
    })

    let output = ''
    child.stdout?.on('data', (data: Buffer) => { output += data.toString() })
    child.stderr?.on('data', (data: Buffer) => { output += data.toString() })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? 1, output }))
  })
}

// ── Deploy Manager ──

export class DeployManager {
  /**
   * Build the project for production
   */
  static async buildProject(
    slug: string,
    onLog?: (line: string) => void
  ): Promise<void> {
    const projectPath = getProjectPath(slug)
    if (!existsSync(projectPath)) {
      throw new Error(`Project "${slug}" not found`)
    }

    const log = onLog || (() => {})
    log('[build] Starting production build...')

    // Read project env for build
    const envOverrides: Record<string, string> = {}
    try {
      const envContent = readFileSync(path.join(projectPath, '.env'), 'utf-8')
      for (const line of envContent.split('\n')) {
        const match = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?\s*$/)
        if (match) {
          envOverrides[match[1]] = match[2]
        }
      }
    } catch {
      // continue without overrides
    }

    const { code, output } = await runCommand('pnpm', ['build'], projectPath, envOverrides)

    if (code !== 0) {
      log(`[build] Build failed (exit ${code})`)
      throw new Error(`Build failed: ${output.slice(-500)}`)
    }

    log('[build] Build complete')
  }

  /**
   * Start the project with PM2
   */
  static async startWithPM2(
    slug: string,
    port: number,
    onLog?: (line: string) => void
  ): Promise<void> {
    const projectPath = getProjectPath(slug)
    const pm2Name = `studio-${slug}`
    const log = onLog || (() => {})

    log(`[pm2] Starting "${pm2Name}" on port ${port}...`)

    // Read project env
    const envOverrides: Record<string, string> = { PORT: String(port), NODE_ENV: 'production' }
    try {
      const envContent = readFileSync(path.join(projectPath, '.env'), 'utf-8')
      for (const line of envContent.split('\n')) {
        const match = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?\s*$/)
        if (match) {
          envOverrides[match[1]] = match[2]
        }
      }
    } catch {
      // continue
    }

    // Update the .env PORT and APP_URL for production
    envOverrides['PORT'] = String(port)
    envOverrides['NEXT_PUBLIC_APP_URL'] = `http://localhost:${port}`
    envOverrides['BETTER_AUTH_URL'] = `http://localhost:${port}`

    // Build the env string for PM2
    const envArgs = Object.entries(envOverrides)
      .map(([k, v]) => `--env ${k}="${v}"`)
      .join(' ')

    // Stop existing if running
    await runCommand('pm2', ['delete', pm2Name], projectPath).catch(() => {})

    // Start with PM2
    const startScript = path.join(projectPath, 'node_modules', '.bin', 'next')
    const { code, output } = await runCommand(
      'pm2',
      ['start', startScript, '--name', pm2Name, '--', 'start', '-p', String(port)],
      projectPath,
      envOverrides
    )

    if (code !== 0) {
      log(`[pm2] Failed to start (exit ${code})`)
      throw new Error(`PM2 start failed: ${output.slice(-300)}`)
    }

    log(`[pm2] Process "${pm2Name}" started on port ${port}`)
  }

  /**
   * Stop a PM2 process
   */
  static async stopPM2(slug: string): Promise<void> {
    const pm2Name = `studio-${slug}`
    await runCommand('pm2', ['delete', pm2Name], getProjectsRoot()).catch(() => {})
  }

  /**
   * Register with Caddy reverse proxy (port-based for now)
   */
  static async registerCaddy(
    slug: string,
    port: number,
    onLog?: (line: string) => void
  ): Promise<string> {
    const log = onLog || (() => {})

    // For now, use direct port access (subdomain routing added later)
    const url = `http://localhost:${port}`

    // Try to register with Caddy admin API (if available)
    try {
      const caddyResponse = await fetch('http://localhost:2019/config/apps/http/servers/srv0/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match: [{ host: [`${slug}.studio.localhost`] }],
          handle: [{
            handler: 'reverse_proxy',
            upstreams: [{ dial: `localhost:${port}` }],
          }],
        }),
      })

      if (caddyResponse.ok) {
        const subdomain = `${slug}.studio.localhost`
        log(`[caddy] Route registered: ${subdomain} -> localhost:${port}`)
        return `http://${subdomain}`
      }
    } catch {
      // Caddy admin API not available — use direct port
      log('[caddy] Admin API not available, using direct port access')
    }

    return url
  }

  /**
   * Get deployment status
   */
  static async getStatus(slug: string): Promise<DeployStatus> {
    const registry = await loadRegistry()
    const deployment = registry.deployments[slug]

    if (!deployment) {
      return { slug, status: 'stopped' }
    }

    // Check if PM2 process is running
    try {
      const { output } = await runCommand('pm2', ['jlist'], getProjectsRoot())
      const processes = JSON.parse(output)
      const proc = processes.find((p: { name: string }) => p.name === deployment.pm2Name)

      if (proc && proc.pm2_env?.status === 'online') {
        return {
          slug,
          status: 'deployed',
          port: deployment.port,
          url: deployment.url,
          pm2Name: deployment.pm2Name,
          deployedAt: deployment.deployedAt,
        }
      }
    } catch {
      // PM2 not available
    }

    return {
      slug,
      status: 'stopped',
      port: deployment.port,
      url: deployment.url,
      pm2Name: deployment.pm2Name,
    }
  }

  /**
   * Full deployment pipeline: build → PM2 → Caddy
   */
  static async deploy(
    slug: string,
    onStep: (step: DeployStep, message: string) => void
  ): Promise<{ url: string; port: number }> {
    const port = await allocatePort()

    // Step 1: Build
    onStep('building', `Building project for production...`)
    await this.buildProject(slug, (line) => onStep('building', line))

    // Step 2: Start PM2
    onStep('starting', `Starting with PM2 on port ${port}...`)
    await this.startWithPM2(slug, port, (line) => onStep('starting', line))

    // Step 3: Register Caddy
    onStep('routing', 'Configuring reverse proxy...')
    const url = await this.registerCaddy(slug, port, (line) => onStep('routing', line))

    // Save to registry
    const registry = await loadRegistry()
    registry.deployments[slug] = {
      port,
      pm2Name: `studio-${slug}`,
      deployedAt: new Date().toISOString(),
      url,
    }
    await saveRegistry(registry)

    onStep('done', `Deployed at ${url}`)
    return { url, port }
  }

  /**
   * Teardown: stop PM2, remove from registry
   */
  static async teardown(slug: string): Promise<void> {
    await this.stopPM2(slug)

    const registry = await loadRegistry()
    delete registry.deployments[slug]
    await saveRegistry(registry)
  }
}
