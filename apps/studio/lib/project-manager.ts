/**
 * Project Manager
 *
 * Manages generated studio projects: creation, file listing,
 * dev server lifecycle. Singleton state shared across API routes.
 */

import { spawn, type ChildProcess } from 'child_process'
import { readdir, readFile, stat, mkdir } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

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
 * Generate a project using create-nextspark-app
 */
export function generateProject(
  slug: string,
  options: {
    preset: string
    name: string
    description: string
    theme?: string
    plugins?: string[]
  },
  onData: (line: string) => void,
  onDone: (code: number) => void
) {
  const projectPath = getProjectPath(slug)

  // Ensure parent dir exists
  if (!existsSync(PROJECTS_ROOT)) {
    require('fs').mkdirSync(PROJECTS_ROOT, { recursive: true })
  }

  // Build the command
  const args = [
    'create-nextspark-app',
    slug,
    '--preset', options.preset,
    '--name', `"${options.name}"`,
    '--slug', slug,
    '--description', `"${options.description}"`,
    '--yes',
  ]

  if (options.theme) {
    args.push('--theme', options.theme)
  }
  if (options.plugins && options.plugins.length > 0) {
    args.push('--plugins', `"${options.plugins.join(',')}"`)
  }

  onData(`[studio] Running: npx ${args.join(' ')}`)
  onData(`[studio] Directory: ${PROJECTS_ROOT}`)

  const child = spawn('npx', args, {
    cwd: PROJECTS_ROOT,
    shell: true,
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      CI: 'true',
      TERM: 'dumb',
      NO_COLOR: '1',
    },
  })

  // Strip ANSI escape codes from output
  const stripAnsi = (text: string) =>
    text.replace(/\x1B\[[0-9;]*[a-zA-Z]|\x1B\].*?\x07|\x1B\[.*?[Gm]|\r/g, '')

  child.stdout?.on('data', (data: Buffer) => {
    const clean = stripAnsi(data.toString())
    const lines = clean.split('\n').filter((l) => l.trim())
    lines.forEach(onData)
  })

  child.stderr?.on('data', (data: Buffer) => {
    const clean = stripAnsi(data.toString())
    const lines = clean.split('\n').filter((l) => l.trim())
    lines.forEach((line) => onData(`[stderr] ${line}`))
  })

  child.on('close', (code) => {
    if (code === 0) {
      setCurrentProject(slug)
    }
    onDone(code ?? 1)
  })

  return child
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

/**
 * Start pnpm dev on a generated project
 */
export function startPreview(slug: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const existing = runningServers.get(slug)
    if (existing) {
      resolve(existing.port)
      return
    }

    const projectPath = getProjectPath(slug)
    const port = 5100 + Math.floor(Math.random() * 900)

    const child = spawn('pnpm', ['dev', '--', '-p', String(port)], {
      cwd: projectPath,
      shell: true,
      env: { ...process.env, PORT: String(port), FORCE_COLOR: '0' },
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
