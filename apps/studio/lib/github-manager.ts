/**
 * GitHub Manager
 *
 * Handles GitHub OAuth, repo creation, and project push.
 * Token is encrypted and stored in an httpOnly cookie.
 */

import { spawn } from 'child_process'
import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs'
import path from 'path'
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'
import { Octokit } from 'octokit'
import { getProjectPath } from './project-manager'

// ─── Config ────────────────────────────────────────────────────────────────

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || ''
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || ''
const GITHUB_PAT = process.env.GITHUB_PAT || '' // Dev mode: skip OAuth, use PAT directly
const ENCRYPTION_KEY = process.env.GITHUB_TOKEN_SECRET || process.env.BETTER_AUTH_SECRET || 'studio-dev-key-change-me'
const CALLBACK_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/github/callback`
  : 'http://localhost:4000/api/github/callback'

// ─── Token Encryption ──────────────────────────────────────────────────────

function getEncryptionKey(): Buffer {
  return createHash('sha256').update(ENCRYPTION_KEY).digest()
}

export function encryptToken(token: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', getEncryptionKey(), iv)
  let encrypted = cipher.update(token, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

export function decryptToken(encrypted: string): string {
  const [ivHex, data] = encrypted.split(':')
  if (!ivHex || !data) throw new Error('Invalid encrypted token format')
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = createDecipheriv('aes-256-cbc', getEncryptionKey(), iv)
  let decrypted = decipher.update(data, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// ─── OAuth ─────────────────────────────────────────────────────────────────

export function getAuthUrl(returnTo?: string): string {
  if (!GITHUB_CLIENT_ID) {
    throw new Error('GITHUB_CLIENT_ID not configured')
  }

  // Encode returnTo URL in state so the callback can redirect back
  const statePayload = JSON.stringify({
    nonce: randomBytes(8).toString('hex'),
    returnTo: returnTo || '/build',
  })
  const state = Buffer.from(statePayload).toString('base64url')

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: CALLBACK_URL,
    scope: 'repo',
    state,
  })

  return `https://github.com/login/oauth/authorize?${params.toString()}`
}

export function parseState(state: string): { returnTo: string } {
  try {
    const payload = JSON.parse(Buffer.from(state, 'base64url').toString())
    return { returnTo: payload.returnTo || '/build' }
  } catch {
    return { returnTo: '/build' }
  }
}

export async function exchangeToken(code: string): Promise<string> {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    throw new Error('GitHub OAuth not configured (missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET)')
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: CALLBACK_URL,
    }),
  })

  const data = await response.json()

  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`)
  }

  if (!data.access_token) {
    throw new Error('No access token received from GitHub')
  }

  return data.access_token
}

// ─── GitHub API ────────────────────────────────────────────────────────────

export interface GitHubUser {
  login: string
  avatar_url: string
  name: string | null
  html_url: string
}

export async function getUser(token: string): Promise<GitHubUser> {
  const octokit = new Octokit({ auth: token })
  const { data } = await octokit.rest.users.getAuthenticated()
  return {
    login: data.login,
    avatar_url: data.avatar_url,
    name: data.name,
    html_url: data.html_url,
  }
}

export interface CreateRepoOptions {
  name: string
  description?: string
  isPrivate?: boolean
}

export interface RepoResult {
  url: string
  cloneUrl: string
  fullName: string
}

export async function createRepo(token: string, options: CreateRepoOptions): Promise<RepoResult> {
  const octokit = new Octokit({ auth: token })

  const { data } = await octokit.rest.repos.createForAuthenticatedUser({
    name: options.name,
    description: options.description || '',
    private: options.isPrivate ?? true,
    auto_init: false, // We'll push our own content
  })

  return {
    url: data.html_url,
    cloneUrl: data.clone_url,
    fullName: data.full_name,
  }
}

// ─── Push Project ──────────────────────────────────────────────────────────

export interface PushOptions {
  slug: string
  repoFullName: string
  cloneUrl: string
  token: string
  sanitizeEnv?: boolean
  addReadme?: boolean
  onLog?: (step: string) => void
}

/**
 * Push a generated project to a GitHub repo.
 *
 * 1. Sanitize .env (replace credentials with placeholders)
 * 2. Generate README.md if requested
 * 3. git init → add → commit → push
 * 4. Restore original .env
 * 5. Clean token from git remote
 */
export async function pushProject(options: PushOptions): Promise<void> {
  const { slug, repoFullName, cloneUrl, token, sanitizeEnv = true, addReadme = true, onLog } = options
  const log = onLog || (() => {})
  const projectPath = getProjectPath(slug)

  if (!existsSync(projectPath)) {
    throw new Error(`Project "${slug}" not found`)
  }

  // Step 1: Sanitize .env
  const envPath = path.join(projectPath, '.env')
  let originalEnv: string | null = null

  if (sanitizeEnv && existsSync(envPath)) {
    log('sanitizing')
    originalEnv = readFileSync(envPath, 'utf-8')

    const sanitized = originalEnv
      .replace(/^(DATABASE_URL)=.+$/m, '$1="postgresql://user:password@localhost:5432/mydb"')
      .replace(/^(BETTER_AUTH_SECRET)=.+$/m, '$1="generate-a-random-secret-here"')
      .replace(/^(BETTER_AUTH_URL)=.+$/m, '$1="http://localhost:3000"')
      .replace(/^(NEXT_PUBLIC_APP_URL)=.+$/m, '$1="http://localhost:3000"')
      .replace(/^(STRIPE_SECRET_KEY)=.+$/m, '$1=""')
      .replace(/^(STRIPE_WEBHOOK_SECRET)=.+$/m, '$1=""')
      .replace(/^(NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)=.+$/m, '$1=""')
      .replace(/^(RESEND_API_KEY)=.+$/m, '$1=""')

    writeFileSync(envPath, sanitized, 'utf-8')

    // Also create .env.example
    writeFileSync(path.join(projectPath, '.env.example'), sanitized, 'utf-8')
  }

  // Step 2: Generate README
  if (addReadme) {
    const readme = generateReadme(slug, repoFullName)
    writeFileSync(path.join(projectPath, 'README.md'), readme, 'utf-8')
  }

  try {
    // Step 3: Ensure .gitignore has essential entries
    ensureGitignore(projectPath)

    // Step 4: Clean previous .git if exists (from failed push)
    const gitDir = path.join(projectPath, '.git')
    if (existsSync(gitDir)) {
      rmSync(gitDir, { recursive: true, force: true })
    }

    // Step 4: git init
    log('initializing')
    await runGit(projectPath, ['init', '-b', 'main'])

    // Step 4b: Set git author (required inside Docker where no global config exists)
    const ghUser = repoFullName.split('/')[0] || 'nextspark-studio'
    await runGit(projectPath, ['config', 'user.email', `${ghUser}@users.noreply.github.com`])
    await runGit(projectPath, ['config', 'user.name', ghUser])

    // Step 5: git add
    log('staging')
    await runGit(projectPath, ['add', '-A'])

    // Step 6: git commit
    log('committing')
    await runGit(projectPath, ['commit', '-m', 'Initial commit from NextSpark Studio'])

    // Step 7: git remote + push (with token in URL)
    log('pushing')
    const authUrl = cloneUrl.replace('https://', `https://x-access-token:${token}@`)
    await runGit(projectPath, ['remote', 'add', 'origin', authUrl])
    await runGit(projectPath, ['push', '-u', 'origin', 'main', '--force'])

    // Step 8: Clean token from remote URL
    log('cleaning')
    await runGit(projectPath, ['remote', 'set-url', 'origin', cloneUrl])

  } finally {
    // Restore original .env
    if (originalEnv !== null) {
      writeFileSync(envPath, originalEnv, 'utf-8')
    }
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const REQUIRED_GITIGNORE_ENTRIES = [
  'node_modules',
  '.next',
  '.turbo',
  '.env',
  '.env.local',
  '.git',
]

function ensureGitignore(projectPath: string): void {
  const gitignorePath = path.join(projectPath, '.gitignore')
  let content = ''

  if (existsSync(gitignorePath)) {
    content = readFileSync(gitignorePath, 'utf-8')
  }

  const lines = content.split('\n').map((l) => l.trim())
  const missing = REQUIRED_GITIGNORE_ENTRIES.filter((entry) => !lines.includes(entry))

  if (missing.length > 0) {
    const suffix = (content && !content.endsWith('\n') ? '\n' : '') +
      '\n# Added by NextSpark Studio\n' +
      missing.join('\n') + '\n'
    writeFileSync(gitignorePath, content + suffix, 'utf-8')
  }
}

function runGit(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0', // Never prompt for credentials
      },
      stdio: 'pipe',
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`git ${args[0]} failed (exit ${code}): ${stderr.trim() || stdout.trim()}`))
      } else {
        resolve(stdout.trim())
      }
    })
  })
}

function generateReadme(slug: string, repoFullName: string): string {
  const name = slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  return `# ${name}

Built with [NextSpark](https://nextspark.dev) — a production-ready SaaS framework on Next.js 15.

## Getting Started

\`\`\`bash
# Clone the repository
git clone https://github.com/${repoFullName}.git
cd ${slug}

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials and secrets

# Set up database
pnpm db:setup

# Start development server
pnpm dev
\`\`\`

## Features

- Authentication (email + social login)
- Teams & permissions
- Billing & subscriptions
- Page builder
- Admin dashboard
- API endpoints
- i18n support

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Database:** PostgreSQL + Drizzle ORM
- **Auth:** Better Auth
- **UI:** shadcn/ui + Tailwind CSS
- **Language:** TypeScript

---

Generated with [NextSpark Studio](https://nextspark.dev/studio)
`
}

export function isConfigured(): boolean {
  return (!!GITHUB_CLIENT_ID && !!GITHUB_CLIENT_SECRET) || !!GITHUB_PAT
}

/** Dev mode: return PAT directly if set (skips OAuth) */
export function getDevToken(): string | null {
  return GITHUB_PAT || null
}

export function isDevMode(): boolean {
  return !!GITHUB_PAT
}
