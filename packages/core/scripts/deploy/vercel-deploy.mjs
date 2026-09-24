#!/usr/bin/env node

/**
 * Unified Vercel Deployment & Environment Management Script
 *
 * Features:
 * - Merges local .env files (root + plugins + environment-specific)
 * - Uploads environment variables to Vercel (with diff visualization)
 * - Deploys to Vercel with automatic domain management
 * - Vercel Custom Environments support for staging (NEW!)
 * - Automatic staging environment creation and configuration
 * - Domain assignment to custom environments
 *
 * Usage:
 *   pnpm vercel:deploy --prod           # Deploy to production
 *   pnpm vercel:deploy --staging        # Deploy to staging custom environment
 *   pnpm vercel:deploy --prod --skip-env    # Skip env var update
 *
 * Staging Environment Setup (Using Custom Environments):
 *   1. Create .env.staging file with your staging configuration
 *   2. Set NEXT_PUBLIC_APP_URL=https://staging.yourdomain.com
 *   3. Run: pnpm vercel:deploy --staging
 *   4. Script will automatically:
 *      - Check if "staging" custom environment exists in Vercel
 *      - Create custom environment if missing (with branch matcher: "staging")
 *      - Check if domain exists and is configured
 *      - Add domain to project with custom environment assignment
 *      - Deploy to staging custom environment
 *      - Configure environment variables for preview scope
 *
 * Environment Variable Precedence (for staging):
 *   1. Root .env (base configuration)
 *   2. Plugin .env files (plugin-specific vars)
 *   3. .env.staging (staging overrides)
 *   4. Debug variables automatically set to false
 *
 * Environment Variable Scoping:
 *   - Production: Uses "production" environment in Vercel
 *   - Staging: Uses "preview" environment scope (custom environment inherits this)
 *   - Variables are scoped per Vercel's environment system
 *
 * Vercel Custom Environments Explained:
 *   Custom Environments are pre-production environments (staging, QA, etc.)
 *   designed for long-running use, unlike ephemeral preview deployments.
 *
 *   Benefits:
 *   - Dedicated domains per environment
 *   - Branch-based automatic deployments (e.g., "staging" branch → staging env)
 *   - Environment-specific configuration
 *   - Up to 12 custom environments per project
 *
 *   This script uses Vercel REST API to:
 *   - List custom environments: GET /v9/projects/{id}/custom-environments
 *   - Create custom environment: POST /v9/projects/{id}/custom-environments
 *   - Add domain to custom environment: POST /v9/projects/{id}/domains
 *
 * Git Branch Workflow (Recommended):
 *   1. Create a "staging" branch: git checkout -b staging
 *   2. Push to remote: git push origin staging
 *   3. Run: pnpm vercel:deploy --staging
 *   4. Future pushes to "staging" branch auto-deploy to staging environment
 *
 * Authentication:
 *   Script uses VERCEL_TOKEN environment variable or Vercel CLI authentication.
 *   Requires sufficient permissions to manage custom environments and domains.
 */

import { spawn } from 'child_process'
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import readline from 'readline'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// Path from packages/core/scripts/deploy/ to project root (4 levels up)
const projectRoot = join(__dirname, '../../../..')

// ============================================================================
// Load Environment Variables from .env
// ============================================================================

/**
 * Load environment variables from .env file into process.env
 * This ensures VERCEL_TOKEN and other vars are available
 */
function loadEnvironmentVariables() {
  const envPath = join(projectRoot, '.env')

  if (!existsSync(envPath)) {
    return // .env not found, continue without it
  }

  try {
    const envContent = readFileSync(envPath, 'utf-8')
    const lines = envContent.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
      if (match) {
        const [, key, rawValue] = match
        // Remove surrounding quotes if present
        let value = rawValue.trim()
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }

        // Only set if not already defined in process.env
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️  Warning: Could not load .env file: ${error.message}`)
  }
}

// Load environment variables immediately
loadEnvironmentVariables()

// ============================================================================
// Configuration
// ============================================================================

/**
 * Read deployment configuration from .env file
 */
function readDeploymentConfig() {
  const envPath = join(projectRoot, '.env')

  if (!existsSync(envPath)) {
    console.error('❌ Error: .env file not found')
    console.error('   Cannot determine deployment configuration')
    process.exit(1)
  }

  const envContent = readFileSync(envPath, 'utf-8')

  // Extract VERCEL_TEAM (required)
  const teamMatch = envContent.match(/^VERCEL_TEAM\s*=\s*['"]?([^'"\n]+)['"]?/m)
  if (!teamMatch) {
    console.error('❌ Error: VERCEL_TEAM not found in .env')
    console.error('   This variable is required to determine the Vercel team')
    console.error('   Add to .env: VERCEL_TEAM=your-team-slug')
    process.exit(1)
  }

  // Extract VERCEL_PROJECT (optional - falls back to package name)
  const projectMatch = envContent.match(/^VERCEL_PROJECT\s*=\s*['"]?([^'"\n]+)['"]?/m)
  let packageName = null
  try {
    packageName = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')).name
  } catch {}
  const project = projectMatch ? projectMatch[1].trim() : packageName?.replace(/^@[^/]+\//, '')

  if (!project) {
    console.error('❌ Error: VERCEL_PROJECT is absent and package.json has no project name')
    console.error('   Add to .env: VERCEL_PROJECT=your-project-name')
    process.exit(1)
  }

  return {
    project: project,
    team: teamMatch[1].trim()
  }
}

/**
 * Build project config dynamically based on .env configuration
 */
function getProjectConfig(target) {
  const { project, team } = readDeploymentConfig()

  // Determine project name:
  // - If VERCEL_PROJECT exists: use it as-is (same project, different envs)
  // - If using theme name: append '-staging' for staging target
  const envContent = readFileSync(join(projectRoot, '.env'), 'utf-8')
  const hasExplicitProject = /^VERCEL_PROJECT\s*=/m.test(envContent)

  const projectName = hasExplicitProject
    ? project  // Use VERCEL_PROJECT as-is (same project for both)
    : (target === 'production' ? project : `${project}-staging`)  // Theme-based: append -staging

  // Read staging domain from .env.staging if available
  let stagingDomain = null
  if (target === 'staging') {
    const stagingEnvPath = join(projectRoot, '.env.staging')
    if (existsSync(stagingEnvPath)) {
      const stagingEnvContent = readFileSync(stagingEnvPath, 'utf-8')
      const urlMatch = stagingEnvContent.match(/^NEXT_PUBLIC_APP_URL\s*=\s*['"]?https?:\/\/([^'"\n]+)['"]?/m)
      if (urlMatch) {
        stagingDomain = urlMatch[1].trim()
      }
    }
  }

  return {
    name: projectName,
    team: team,
    url: `https://vercel.com/${team}/${projectName}`,
    // Environment configuration:
    // With VERCEL_PROJECT: same project, different environments (production vs preview)
    // With theme fallback: different projects, both use production environment
    env: target === 'production' ? 'production' : 'preview',
    stagingDomain: stagingDomain
  }
}

const SENSITIVE_PATTERNS = [
  /SECRET/i, /KEY$/i, /TOKEN/i, /PASSWORD/i, /API_KEY/i, /PRIVATE/i,
  /DATABASE_URL/i, /WEBHOOK_SECRET/i, /_KEY$/i, /_SECRET$/i,
  /ANTHROPIC/i, /OPENAI/i, /STRIPE.*KEY/i, /RESEND/i, /BETTER_AUTH_SECRET/i
]

const PUBLIC_EXCEPTIONS = [/^NEXT_PUBLIC_/i, /PUBLISHABLE/i, /PUBLIC_KEY/i]

// Debug variable patterns (automatically set to false in production/staging)
const DEBUG_PATTERNS = [
  /^.*_DEBUG$/i,           // Ends with _DEBUG (e.g., AI_PLUGIN_DEBUG)
  /^DEBUG_/i,              // Starts with DEBUG_ (e.g., DEBUG_MODE)
  /^NEXT_PUBLIC_.*_DEBUG$/i // Public debug vars (e.g., NEXT_PUBLIC_API_DEBUG)
]

// ============================================================================
// Utilities
// ============================================================================

/**
 * Normalize environment variable value by removing quotes and whitespace
 * Used for both comparison and upload to ensure consistent formatting
 */
function normalizeValue(val) {
  if (!val) return val

  // Remove trailing whitespace and newlines
  let normalized = val.trim()

  // Remove all surrounding quotes (double or single) recursively
  // Trim after each iteration to handle cases like: "value\n" → value\n → value
  let prevValue = ''
  while (normalized !== prevValue) {
    prevValue = normalized
    normalized = normalized.replace(/^["'](.*)["']$/, '$1').trim()
  }

  // Remove literal \n, \r, \t that Vercel CLI sometimes adds as string literals
  normalized = normalized.replace(/\\n$/g, '').replace(/\\r$/g, '').replace(/\\t$/g, '')

  return normalized
}

function execCommand(command, args = [], input = null, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: input ? ['pipe', 'pipe', 'pipe'] : options.inheritStdio ? 'inherit' : 'pipe',
      cwd: options.cwd || projectRoot
    })

    let stdout = ''
    let stderr = ''

    if (!options.inheritStdio) {
      if (proc.stdout) proc.stdout.on('data', (data) => stdout += data.toString())
      if (proc.stderr) proc.stderr.on('data', (data) => stderr += data.toString())
    }

    if (input && proc.stdin) {
      proc.stdin.write(input)
      proc.stdin.end()
    }

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code })
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`))
      }
    })

    proc.on('error', (error) => reject(error))
  })
}

function confirm(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

// ============================================================================
// Vercel API Helpers
// ============================================================================

/**
 * Get Vercel API token from environment or CLI config file
 */
async function getVercelToken() {
  // Priority 1: Check if VERCEL_TOKEN is in environment
  if (process.env.VERCEL_TOKEN) {
    return process.env.VERCEL_TOKEN
  }

  // Priority 2: Try to read token from Vercel CLI auth.json
  // Default location: ~/.local/share/com.vercel.cli/auth.json
  const os = await import('os')
  const possiblePaths = [
    join(os.homedir(), '.local/share/com.vercel.cli/auth.json'),
    join(os.homedir(), '.vercel/auth.json'),
    join(os.homedir(), '.config/com.vercel.cli/auth.json')
  ]

  for (const authPath of possiblePaths) {
    if (existsSync(authPath)) {
      try {
        const authData = JSON.parse(readFileSync(authPath, 'utf-8'))
        if (authData.token) {
          return authData.token
        }
      } catch (error) {
        // Continue to next path if parsing fails
        continue
      }
    }
  }

  // No token found
  console.error('   ❌ Could not retrieve Vercel API token')
  console.error('   Please either:')
  console.error('   1. Run: vercel login')
  console.error('   2. Set VERCEL_TOKEN environment variable\n')
  process.exit(1)
}

/**
 * Make a Vercel API request
 */
async function vercelAPIRequest(endpoint, options = {}) {
  const token = await getVercelToken()
  const baseURL = 'https://api.vercel.com'

  const url = `${baseURL}${endpoint}`
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(`API Error ${response.status}: ${data.error?.message || JSON.stringify(data)}`)
    }

    return data
  } catch (error) {
    throw new Error(`Vercel API request failed: ${error.message}`)
  }
}

// ============================================================================
// Custom Environment Management
// ============================================================================

/**
 * List all custom environments for the project
 */
async function listCustomEnvironments(projectConfig) {
  try {
    const endpoint = `/v9/projects/${projectConfig.name}/custom-environments?teamId=${projectConfig.team}`
    const data = await vercelAPIRequest(endpoint, { method: 'GET' })

    // API returns "environments" not "customEnvironments"
    return data.environments || data.customEnvironments || []
  } catch (error) {
    console.warn('   ⚠️  Could not list custom environments:', error.message)
    return []
  }
}

/**
 * Check if a custom environment exists
 */
async function customEnvironmentExists(projectConfig, envSlug) {
  const environments = await listCustomEnvironments(projectConfig)
  return environments.find(env => env.slug === envSlug) || null
}

/**
 * Create a custom environment for staging
 */
async function createCustomEnvironment(projectConfig) {
  console.log(`\n🔧 Creating custom environment "staging"...`)

  try {
    const endpoint = `/v9/projects/${projectConfig.name}/custom-environments?teamId=${projectConfig.team}`

    const requestBody = {
      slug: 'staging',
      description: 'Staging environment for pre-production testing',
      branchMatcher: {
        type: 'equals',
        pattern: 'staging'
      }
    }

    const data = await vercelAPIRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(requestBody)
    })

    console.log(`   ✅ Custom environment created: ${data.slug}`)
    console.log(`   💡 Branch matcher: ${data.branchMatcher?.type} "${data.branchMatcher?.pattern}"\n`)

    return data
  } catch (error) {
    console.error(`\n   ❌ Failed to create custom environment`)
    console.error(`   Error: ${error.message}\n`)
    console.error('   💡 You may need to create it manually via Vercel Dashboard:')
    console.error(`   ${projectConfig.url}/settings/environments\n`)

    throw error
  }
}

/**
 * Ensure staging custom environment exists
 */
async function ensureCustomEnvironment(projectConfig) {
  console.log(`\n📋 Checking staging custom environment...\n`)

  // Check if staging environment already exists
  const existingEnv = await customEnvironmentExists(projectConfig, 'staging')

  if (existingEnv) {
    console.log(`   ✅ Custom environment "staging" already exists`)
    console.log(`   ID: ${existingEnv.id}`)
    if (existingEnv.branchMatcher) {
      console.log(`   Branch matcher: ${existingEnv.branchMatcher.type} "${existingEnv.branchMatcher.pattern}"`)
    }
    console.log('')
    return existingEnv
  }

  // Environment doesn't exist, ask user if they want to create it
  console.log(`   ℹ️  Custom environment "staging" not found`)
  const shouldCreate = await confirm('   Create custom environment for staging')

  if (!shouldCreate) {
    console.log('\n   ⏭️  Skipping custom environment creation')
    console.log('   ⚠️  Without a custom environment, deployments will use preview environment\n')
    return null
  }

  // Create the custom environment
  return await createCustomEnvironment(projectConfig)
}

// ============================================================================
// Domain Management
// ============================================================================

/**
 * Check if domain is already assigned to this project using Vercel API
 * Returns domain info including current customEnvironmentId if any
 */
async function isDomainOnThisProject(domain, projectConfig) {
  try {
    // Use Vercel API to get domain info from project
    const endpoint = `/v9/projects/${projectConfig.name}/domains/${domain}?teamId=${projectConfig.team}`
    const data = await vercelAPIRequest(endpoint, { method: 'GET' })

    // Domain exists on this project
    return {
      onThisProject: true,
      data,
      currentCustomEnvId: data.customEnvironmentId || null
    }
  } catch (error) {
    // Domain not found on this project (404) or other error
    return { onThisProject: false }
  }
}

/**
 * Add a domain to the Vercel project with custom environment support
 */
async function addDomainToProject(domain, projectConfig, customEnvironmentId = null) {
  console.log(`\n🌐 Configuring domain for project...`)
  console.log(`   Domain: ${domain}`)
  console.log(`   Project: ${projectConfig.name}`)
  if (customEnvironmentId) {
    console.log(`   Custom Environment: staging (${customEnvironmentId})`)
  }
  console.log(`   Team: ${projectConfig.team}\n`)

  // First, check if domain is already on this project
  console.log(`   🔍 Checking if domain is already configured...`)
  const checkResult = await isDomainOnThisProject(domain, projectConfig)

  if (checkResult.onThisProject) {
    // Domain exists on project - check if custom environment ID needs update
    const currentEnvId = checkResult.currentCustomEnvId

    if (customEnvironmentId && currentEnvId !== customEnvironmentId) {
      console.log(`   ⚠️  Domain exists but assigned to different custom environment`)
      console.log(`      Current: ${currentEnvId || 'none'}`)
      console.log(`      Target: ${customEnvironmentId}`)
      console.log(`   🔄 Updating domain assignment...\n`)

      // Update domain's custom environment ID via PATCH
      try {
        const endpoint = `/v9/projects/${projectConfig.name}/domains/${domain}?teamId=${projectConfig.team}`
        await vercelAPIRequest(endpoint, {
          method: 'PATCH',
          body: JSON.stringify({ customEnvironmentId })
        })
        console.log(`   ✅ Domain updated to new custom environment\n`)
        return { success: true, alreadyConfigured: true, updated: true }
      } catch (error) {
        console.log(`   ⚠️  Could not update domain: ${error.message}`)
        console.log(`   💡 You may need to update manually via Vercel Dashboard\n`)
        return { success: true, alreadyConfigured: true, updated: false }
      }
    }

    console.log(`   ✅ Domain already configured correctly\n`)
    return { success: true, alreadyConfigured: true }
  }

  console.log(`   ℹ️  Domain not found on this project, attempting to add...\n`)

  try {
    // Use Vercel API to add domain with custom environment support
    const endpoint = `/v9/projects/${projectConfig.name}/domains?teamId=${projectConfig.team}`

    const requestBody = {
      name: domain
    }

    // If custom environment ID is provided, associate domain with it
    if (customEnvironmentId) {
      requestBody.customEnvironmentId = customEnvironmentId
    }

    const data = await vercelAPIRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(requestBody)
    })

    console.log(`   ✅ Domain added successfully: ${domain}`)

    if (!data.verified) {
      console.log(`   ⚠️  Domain needs verification`)
      console.log(`   💡 Configure DNS records:`)
      if (data.verification && data.verification.length > 0) {
        data.verification.forEach(record => {
          console.log(`      ${record.type} ${record.domain} → ${record.value}`)
        })
      }
    }

    console.log('')
    return { success: true, alreadyConfigured: false, data }

  } catch (error) {
    const errorMsg = error.message.toLowerCase()

    // Case 1: Domain already assigned to ANOTHER project
    if (errorMsg.includes('already assigned') || errorMsg.includes('in use')) {
      console.log(`\n   ⚠️  Domain is assigned to a different Vercel project\n`)
      console.log('   📋 To use this domain with the current project:\n')
      console.log('   Option 1 (Recommended): Move domain via Vercel Dashboard')
      console.log(`      1. Go to: https://vercel.com/${projectConfig.team}`)
      console.log('      2. Find the project that currently owns the domain')
      console.log(`      3. Remove ${domain} from that project`)
      console.log(`      4. Go to: ${projectConfig.url}/settings/domains`)
      console.log(`      5. Add ${domain} to this project\n`)

      return { success: false, alreadyOnOtherProject: true }
    }

    // Case 2: Other errors (permissions, network, etc.)
    console.error(`\n   ❌ Failed to configure domain`)
    console.error(`   Error: ${error.message}\n`)
    console.error('   💡 You may need to configure it manually via Vercel Dashboard:')
    console.error(`   ${projectConfig.url}/settings/domains\n`)

    return { success: false, error: error.message }
  }
}

/**
 * Ensure staging domain is configured for the project with custom environment
 * Returns an object with configuration status details
 */
async function ensureStagingDomain(projectConfig, customEnvironment) {
  if (!projectConfig.stagingDomain) {
    console.log('\n📋 Staging Domain Configuration\n')
    console.log('   ⚠️  No staging domain configured in .env.staging')
    console.log('   💡 To set up a staging domain:')
    console.log('      1. Add to .env.staging: NEXT_PUBLIC_APP_URL=https://staging.yourdomain.com')
    console.log('      2. Re-run this deployment script\n')
    console.log('   ℹ️  Deployment will continue without custom domain (will use Vercel preview URL)\n')
    return { configured: false, reason: 'no_domain_in_env' }
  }

  console.log(`\n📋 Staging Domain Configuration`)
  console.log(`   Domain: ${projectConfig.stagingDomain}`)

  if (customEnvironment) {
    console.log(`   Target: Custom Environment "staging"`)
  } else {
    console.log(`   ⚠️  No custom environment - domain will use default preview environment`)
  }

  console.log('')

  // FIRST: Check if domain already exists before asking user
  const customEnvId = customEnvironment ? customEnvironment.id : null
  console.log(`   🔍 Checking if domain is already configured...`)
  const checkResult = await isDomainOnThisProject(projectConfig.stagingDomain, projectConfig)

  if (checkResult.onThisProject) {
    // Domain already exists on this project
    const currentEnvId = checkResult.currentCustomEnvId

    if (customEnvId && currentEnvId === customEnvId) {
      // Domain is already assigned to the correct custom environment
      console.log(`   ✅ Domain already configured correctly`)
      console.log(`   📌 Assigned to: Custom Environment "staging"\n`)
      return { configured: true, alreadyConfigured: true, customEnvironment }
    } else if (customEnvId && currentEnvId !== customEnvId) {
      // Domain exists but assigned to different environment
      console.log(`   ⚠️  Domain exists but assigned to different environment`)
      console.log(`      Current: ${currentEnvId || 'none'}`)
      console.log(`      Target: ${customEnvId}`)
      const shouldUpdate = await confirm('   Update domain assignment to staging environment')

      if (!shouldUpdate) {
        console.log('\n   ⏭️  Skipping domain update\n')
        return { configured: true, alreadyConfigured: true, needsUpdate: true }
      }

      // Update domain to new custom environment
      const result = await addDomainToProject(projectConfig.stagingDomain, projectConfig, customEnvId)
      return result.success
        ? { configured: true, updated: true, customEnvironment }
        : { configured: false, reason: 'update_failed' }
    } else {
      // Domain exists, no custom environment required or already correct
      console.log(`   ✅ Domain already configured\n`)
      return { configured: true, alreadyConfigured: true }
    }
  }

  // Domain doesn't exist, ask if user wants to add it
  console.log(`   ℹ️  Domain not found on this project`)
  const shouldAdd = await confirm('   Add this domain to the project')

  if (!shouldAdd) {
    console.log('\n   ⏭️  Skipping domain configuration')
    console.log('   ℹ️  Deployment will use Vercel preview URL')
    console.log(`   💡 You can add the domain later via Vercel Dashboard\n`)
    return { configured: false, reason: 'user_skipped' }
  }

  // Add domain with custom environment ID if available
  const result = await addDomainToProject(projectConfig.stagingDomain, projectConfig, customEnvId)

  if (result.success) {
    return { configured: true, alreadyConfigured: result.alreadyConfigured, customEnvironment }
  } else if (result.alreadyOnOtherProject) {
    // User needs to migrate domain first
    const shouldContinue = await confirm('   Continue deployment without domain configuration')

    if (shouldContinue) {
      console.log('\n   ⏭️  Continuing with deployment')
      console.log('   ℹ️  Deployment will use Vercel preview URL')
      console.log('   💡 Configure the domain and redeploy to use custom URL\n')
      return { configured: false, reason: 'domain_on_other_project' }
    } else {
      console.log('\n   ❌ Deployment cancelled')
      console.log('   Please migrate the domain and try again\n')
      process.exit(0)
    }
  } else {
    // Other error occurred
    const shouldContinue = await confirm('   Continue deployment despite domain configuration error')

    if (shouldContinue) {
      console.log('\n   ⏭️  Continuing with deployment\n')
      return { configured: false, reason: 'configuration_error' }
    } else {
      console.log('\n   ❌ Deployment cancelled\n')
      process.exit(0)
    }
  }
}

// ============================================================================
// Environment Variable Merging
// ============================================================================

function parseEnvFile(content) {
  const lines = content.split('\n')
  const vars = {}

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
    if (match) {
      const [, key, value] = match
      // Normalize value to remove quotes and whitespace artifacts from Vercel CLI
      vars[key] = normalizeValue(value)
    }
  }

  return vars
}

function readEnvFile(path) {
  if (!existsSync(path)) return {}

  try {
    const content = readFileSync(path, 'utf-8')
    return parseEnvFile(content)
  } catch (error) {
    console.error(`❌ Error reading ${path}:`, error.message)
    return {}
  }
}

function sanitizeDebugVariables(vars, target, explicitOverrides = {}) {
  const sanitized = { ...vars }
  const debugVars = []

  for (const [key, value] of Object.entries(sanitized)) {
    const isDebugVar = DEBUG_PATTERNS.some(pattern => pattern.test(key))
    const hasExplicitOverride = key in explicitOverrides

    // Only sanitize if it's a debug var, not 'false', and not explicitly overridden
    if (isDebugVar && value !== 'false' && !hasExplicitOverride) {
      debugVars.push({ key, original: value })
      sanitized[key] = 'false'
    }
  }

  if (debugVars.length > 0) {
    console.log(`\n🔒 Security: Setting ${debugVars.length} debug variable(s) to false for ${target}:\n`)
    for (const { key, original } of debugVars) {
      console.log(`   🔧 ${key}: ${original} → false`)
    }
    console.log(`\n   💡 To enable debug in ${target}, add to .env.${target}\n`)
  }

  return sanitized
}

function findPluginEnvFiles() {
  const pluginsDir = join(projectRoot, 'plugins')
  const pluginEnvFiles = []

  if (!existsSync(pluginsDir)) return pluginEnvFiles

  const entries = readdirSync(pluginsDir)

  for (const entry of entries) {
    const pluginPath = join(pluginsDir, entry)
    if (!statSync(pluginPath).isDirectory()) continue

    const envPath = join(pluginPath, '.env')
    if (existsSync(envPath)) {
      pluginEnvFiles.push({ name: entry, path: envPath })
    }
  }

  return pluginEnvFiles
}

function mergeEnvironmentVariables(target) {
  console.log('\n📦 Merging environment variables...\n')

  const allVars = {}
  const sections = []

  // 1. Root .env (development defaults)
  const rootVars = readEnvFile(join(projectRoot, '.env'))
  if (Object.keys(rootVars).length > 0) {
    console.log(`   ✅ Root .env (${Object.keys(rootVars).length} variables)`)
    Object.assign(allVars, rootVars)
    sections.push({
      title: 'CORE APPLICATION VARIABLES',
      vars: rootVars
    })
  }

  // 2. Plugin .env files
  const pluginEnvFiles = findPluginEnvFiles()
  for (const { name, path } of pluginEnvFiles) {
    const vars = readEnvFile(path)
    if (Object.keys(vars).length > 0) {
      console.log(`   ✅ Plugin: ${name} (${Object.keys(vars).length} variables)`)
      Object.assign(allVars, vars)
      sections.push({
        title: `PLUGIN: ${name.toUpperCase()}`,
        vars
      })
    }
  }

  // 3. Environment-specific overrides
  // Try target-specific file first (e.g., .env.staging or .env.prod)
  // Then fall back to .env.production.local for backward compatibility
  const targetEnvPath = join(projectRoot, `.env.${target}`)
  const legacyEnvPath = join(projectRoot, '.env.production.local')

  let overrides = {}
  let overridesSource = null

  if (existsSync(targetEnvPath)) {
    overrides = readEnvFile(targetEnvPath)
    overridesSource = `.env.${target}`
  } else if (existsSync(legacyEnvPath)) {
    overrides = readEnvFile(legacyEnvPath)
    overridesSource = '.env.production.local'
  }

  if (Object.keys(overrides).length > 0) {
    console.log(`   ✅ ${overridesSource} (${Object.keys(overrides).length} variables)`)
    Object.assign(allVars, overrides)
    sections.push({
      title: `ENVIRONMENT OVERRIDES (${target})`,
      vars: overrides
    })
  } else {
    console.log(`   ⚠️  No .env.${target} or .env.production.local found`)
    console.log(`   💡 Create .env.${target} for ${target}-specific config`)
  }

  // Sanitize debug variables for production/staging (respecting explicit overrides)
  const sanitizedVars = sanitizeDebugVariables(allVars, target, overrides)

  // Generate consolidated merged file (target-specific naming for clarity)
  let output = `# Auto-generated: ${new Date().toISOString()}\n# DO NOT EDIT MANUALLY - DO NOT COMMIT\n#\n# Merged from:\n`

  for (const section of sections) {
    output += `#   - ${section.title}\n`
  }

  output += `\n`

  // Write all variables (using sanitizedVars which has final merged + sanitized values)
  // Normalize values to match what will be uploaded to Vercel
  for (const [key, value] of Object.entries(sanitizedVars)) {
    const normalizedValue = normalizeValue(value)
    output += `${key}=${normalizedValue}\n`
  }

  // Use target-specific filename: .env.merged.staging, .env.merged.production
  // Use 'target' for filename to match user's expectation (--staging → staging, --prod → prod)
  const outputPath = join(projectRoot, `.env.merged.${target}`)
  writeFileSync(outputPath, output, 'utf-8')

  const totalVars = Object.keys(sanitizedVars).length
  console.log(`\n   ✅ Created .env.merged.${target} with ${totalVars} variables\n`)

  return { outputPath, totalVars, target }
}

// ============================================================================
// Environment Variable Upload
// ============================================================================

function parseEnvFileForUpload(filePath) {
  if (!existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`)
    process.exit(1)
  }

  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const vars = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#')) continue

    const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
    if (match) {
      const [, key, rawValue] = match
      // Normalize value to remove quotes, whitespace, and newlines
      const value = normalizeValue(rawValue)
      vars.push({ key, value })
    }
  }

  return vars
}

/**
 * Validate variables for production deployment
 * Detects localhost URLs and other dev-only values
 */
function validateProductionVars(vars) {
  const critical = []
  const warnings = []

  // Variables that should NEVER have localhost in production
  const criticalVars = [
    'BETTER_AUTH_URL',
    'NEXT_PUBLIC_APP_URL',
    'NEXT_PUBLIC_API_URL',
    'WEBHOOK_URL'
  ]

  // Variables that are OK to have localhost (optional/dev features)
  const allowedLocalhostVars = [
    'OLLAMA_BASE_URL',          // Local AI - optional
    'LOCAL_API_URL',            // Development API
    'DEV_SERVER_URL'            // Development server
  ]

  for (const { key, value } of vars) {
    // Check for localhost URLs
    if (value.includes('localhost') || value.includes('127.0.0.1')) {
      if (criticalVars.includes(key)) {
        critical.push({
          key,
          issue: `🔴 CRITICAL - Contains localhost (${value.substring(0, 40)}...)`
        })
      } else if (!allowedLocalhostVars.includes(key)) {
        warnings.push({
          key,
          issue: `⚠️  Info - Contains localhost (${value.substring(0, 40)}...)`
        })
      }
      // Silently allow for allowedLocalhostVars
    }

    // Check for development-specific values
    if (key.includes('DEV') && !key.includes('DEVELOPER') && !key.includes('DEFAULT')) {
      warnings.push({
        key,
        issue: '⚠️  Info - Looks like a dev-only variable'
      })
    }

    // Check for empty required variables
    if (!value || value.trim() === '') {
      warnings.push({
        key,
        issue: '⚠️  Info - Empty value'
      })
    }
  }

  return { critical, warnings }
}

/**
 * Upload a single environment variable via Vercel CLI
 * Uses projectConfig.env which is set to the custom environment slug if detected
 */
async function uploadVariable(key, value, projectConfig, customEnvironmentSlug = null) {
  try {
    // Use the environment from projectConfig (already set to "staging", "production", etc.)
    // customEnvironmentSlug parameter kept for backward compatibility but projectConfig.env is now authoritative
    const environment = customEnvironmentSlug || projectConfig.env

    // Execute: echo "value" | vercel env add KEY environment
    const result = await execCommand('vercel', ['env', 'add', key, environment], value)

    // Check if output indicates success (vercel outputs to stderr, not stdout)
    const output = result.stderr + result.stdout
    const isSuccess = output.includes('Added Environment Variable') ||
                     output.includes('Environment Variable already exists')

    if (!isSuccess) {
      // Command executed but didn't produce expected output
      const errorMsg = output.trim() || 'Unknown error'
      return { success: false, error: errorMsg }
    }

    const action = output.includes('already exists') ? 'updated' : 'added'
    return { success: true, action }

  } catch (error) {
    return { success: false, error: error.message || 'Command execution failed' }
  }
}

/**
 * Update an existing environment variable by removing and re-adding it
 * This is necessary because Vercel CLI doesn't have an 'update' command
 */
async function updateVariable(key, value, projectConfig, customEnvironmentSlug = null) {
  const environment = customEnvironmentSlug || projectConfig.env

  try {
    // Step 1: Remove existing variable
    await execCommand('vercel', ['env', 'rm', key, environment, '--yes'])

    // Step 2: Add with new value
    const result = await execCommand('vercel', ['env', 'add', key, environment], value)

    // Check if output indicates success
    const output = result.stderr + result.stdout
    const isSuccess = output.includes('Added Environment Variable')

    if (!isSuccess) {
      const errorMsg = output.trim() || 'Failed to add variable after removal'
      return { success: false, error: errorMsg }
    }

    return { success: true, action: 'updated' }

  } catch (error) {
    return { success: false, error: error.message || 'Update failed' }
  }
}

async function uploadVariables(projectConfig, customEnvironmentSlug = null, diffResult = null) {
  // If diffResult provided, only upload changed variables (new + modified)
  let varsToUpload = []

  if (diffResult) {
    // Upload only new and modified variables
    varsToUpload = [
      ...diffResult.newVars.map(v => ({ key: v.key, value: v.value, action: 'add' })),
      ...diffResult.modifiedVars.map(v => ({ key: v.key, value: v.new, action: 'update' }))
    ]
  } else {
    // Fallback: upload all variables from merged file
    const envFilePath = projectConfig.mergedEnvFile || join(projectRoot, '.env.production')
    const allVars = parseEnvFileForUpload(envFilePath)
    varsToUpload = allVars.map(v => ({ key: v.key, value: v.value, action: 'add' }))
  }

  if (varsToUpload.length === 0) {
    console.error('   ❌ No variables to upload')
    return false
  }

  // Validate production-ready variables
  const { critical, warnings } = validateProductionVars(varsToUpload)

  // Show critical issues - require confirmation
  if (critical.length > 0) {
    console.log('\n🔴 CRITICAL ISSUES DETECTED:\n')
    critical.forEach(w => console.log(`   • ${w.key}: ${w.issue}`))
    console.log('\n   These variables will likely break your deployment!\n')

    const shouldContinue = await confirm('   Continue with upload anyway')
    if (!shouldContinue) {
      console.log('\n   ❌ Upload cancelled. Fix the critical issues and try again.\n')
      process.exit(0)
    }
  }

  // Show informational warnings - don't block
  if (warnings.length > 0) {
    console.log('\n💡 Informational warnings:\n')
    warnings.forEach(w => console.log(`   • ${w.key}: ${w.issue}`))
    console.log('\n   (These are informational only - continuing with upload)\n')
  }

  // Log upload destination
  let destination = `${projectConfig.env} environment`
  if (customEnvironmentSlug) {
    destination += ` (custom environment: ${customEnvironmentSlug})`
  }
  console.log(`\n📤 Uploading ${varsToUpload.length} variables to ${destination}...\n`)

  let added = 0
  let updated = 0
  let failed = 0
  const errors = []

  for (let i = 0; i < varsToUpload.length; i++) {
    const { key, value, action } = varsToUpload[i]
    const progress = `[${i + 1}/${varsToUpload.length}]`

    process.stdout.write(`   ${progress} ${key}...`)

    // For update action, remove first then add
    let result
    if (action === 'update') {
      result = await updateVariable(key, value, projectConfig, customEnvironmentSlug)
    } else {
      result = await uploadVariable(key, value, projectConfig, customEnvironmentSlug)
    }

    if (result.success) {
      if (result.action === 'added') {
        process.stdout.write(`\r   ${progress} ✅ ${key} (new)\n`)
        added++
      } else {
        process.stdout.write(`\r   ${progress} ✅ ${key} (updated)\n`)
        updated++
      }
    } else {
      process.stdout.write(`\r   ${progress} ❌ ${key} - ${result.error}\n`)
      failed++
      errors.push({ key, error: result.error, details: result.details })
    }

    await new Promise(resolve => setTimeout(resolve, 150))
  }

  console.log(`\n   📊 Results: ${added} added | ${updated} updated | ${failed} failed\n`)

  if (errors.length > 0) {
    console.log('   ⚠️  Failed variables:')
    errors.forEach(({ key, error }) => {
      console.log(`      • ${key}: ${error}`)
    })
    console.log('')
  }

  return failed === 0
}

// ============================================================================
// Vercel Validation
// ============================================================================

async function checkVercelCLI() {
  try {
    const { stdout } = await execCommand('vercel', ['--version'])
    console.log(`   ✅ Vercel CLI: ${stdout.trim()}`)
    return true
  } catch (error) {
    console.error('   ❌ Vercel CLI not found')
    console.error('   Install: npm i -g vercel && vercel login\n')
    process.exit(1)
  }
}

async function checkVercelAuth() {
  try {
    await execCommand('vercel', ['whoami'])
    console.log('   ✅ Authenticated')
    return true
  } catch (error) {
    console.error('   ❌ Not authenticated')
    console.error('   Run: vercel login\n')
    process.exit(1)
  }
}

async function checkProjectLink(projectConfig) {
  const vercelDir = join(projectRoot, '.vercel')
  const projectJsonPath = join(vercelDir, 'project.json')

  if (!existsSync(projectJsonPath)) {
    console.error(`   ❌ Project not linked`)
    console.error(`   Need to link to: ${projectConfig.name}\n`)

    const shouldLink = await confirm('   Link project now')

    if (shouldLink) {
      return await linkToProject(projectConfig)
    } else {
      console.log('\n   ❌ Cannot deploy without linking project\n')
      process.exit(1)
    }
  }

  // Check if linked to correct project
  try {
    const projectJson = JSON.parse(readFileSync(projectJsonPath, 'utf-8'))
    const linkedProject = projectJson.projectName || projectJson.name

    if (linkedProject !== projectConfig.name) {
      console.error(`   ❌ Linked to wrong project: ${linkedProject}`)
      console.error(`   Expected: ${projectConfig.name}`)
      console.error(`   Team: ${projectConfig.team}\n`)

      const shouldRelink = await confirm('   Unlink current and link to correct project')

      if (shouldRelink) {
        console.log('\n   🔄 Unlinking current project...')
        try {
          await execCommand('vercel', ['unlink'])
          console.log('   ✅ Unlinked\n')
        } catch (error) {
          console.warn('   ⚠️  Unlink failed, continuing anyway...\n')
        }

        return await linkToProject(projectConfig)
      } else {
        console.log('\n   ❌ Cannot deploy to wrong project\n')
        process.exit(1)
      }
    }

    console.log(`   ✅ Project linked: ${linkedProject}`)
    return true
  } catch (error) {
    console.error('   ❌ Error reading project configuration:', error.message)
    process.exit(1)
  }
}

async function linkToProject(projectConfig) {
  console.log(`   🔗 Linking to: ${projectConfig.name}`)
  console.log(`   Team: ${projectConfig.team}\n`)

  try {
    await execCommand('vercel', ['link'], null, { inheritStdio: true })

    // Verify the link was successful
    const projectJsonPath = join(projectRoot, '.vercel/project.json')
    if (existsSync(projectJsonPath)) {
      const projectJson = JSON.parse(readFileSync(projectJsonPath, 'utf-8'))
      const linkedProject = projectJson.projectName || projectJson.name

      console.log(`\n   ✅ Successfully linked to: ${linkedProject}\n`)

      if (linkedProject !== projectConfig.name) {
        console.error(`   ⚠️  Warning: Linked to ${linkedProject} but expected ${projectConfig.name}`)
        const shouldContinue = await confirm('   Continue anyway')
        if (!shouldContinue) {
          process.exit(1)
        }
      }

      return true
    } else {
      console.error('   ❌ Link failed - no project.json created\n')
      process.exit(1)
    }
  } catch (error) {
    console.error('   ❌ Failed to link project:', error.message)
    console.error('   Manual steps:')
    console.error('   1. Run: vercel link')
    console.error(`   2. Select team: ${projectConfig.team}`)
    console.error(`   3. Select project: ${projectConfig.name}\n`)
    process.exit(1)
  }
}

async function pullEnvironmentVariables(projectConfig) {
  console.log(`\n📥 Pulling current environment variables from Vercel...`)
  console.log(`   Environment: ${projectConfig.env}`)
  console.log(`   Project: ${projectConfig.name}\n`)

  // Use environment-specific filename for clarity: .env.vercel.production, .env.vercel.staging, etc.
  const vercelEnvFile = `.env.vercel.${projectConfig.env}`

  try {
    await execCommand('vercel', ['env', 'pull', vercelEnvFile, '--environment', projectConfig.env])

    if (existsSync(join(projectRoot, vercelEnvFile))) {
      console.log(`   ✅ Successfully pulled current Vercel env vars to ${vercelEnvFile}\n`)
      return true
    }
  } catch (error) {
    console.warn('   ⚠️  No env vars in Vercel yet (first deployment?)\n')
  }

  return false
}

/**
 * Compare current Vercel env vars with new local vars and show diff
 */
function showEnvDiff(projectConfig) {
  // Use environment-specific Vercel file: .env.vercel.production, .env.vercel.staging, etc.
  const vercelEnvPath = join(projectRoot, `.env.vercel.${projectConfig.env}`)
  // Use the merged environment file specific to the target
  const localEnvPath = projectConfig.mergedEnvFile || join(projectRoot, '.env.production')

  // Parse both files
  const vercelVars = existsSync(vercelEnvPath) ? parseEnvFile(readFileSync(vercelEnvPath, 'utf-8')) : {}
  const localVars = existsSync(localEnvPath) ? parseEnvFile(readFileSync(localEnvPath, 'utf-8')) : {}

  const vercelKeys = new Set(Object.keys(vercelVars))
  const localKeys = new Set(Object.keys(localVars))

  // Categorize changes
  const newVars = []
  const modifiedVars = []
  const unchangedVars = []
  const deletedVars = []

  // Check local vars
  for (const key of localKeys) {
    if (!vercelKeys.has(key)) {
      newVars.push({ key, value: localVars[key] })
    } else {
      const oldVal = vercelVars[key]
      const newVal = localVars[key]
      const oldNormalized = normalizeValue(oldVal)
      const newNormalized = normalizeValue(newVal)

      if (oldVal !== newVal) {
        // Check if only formatting differs (quotes)
        const isFormatOnly = oldNormalized === newNormalized
        modifiedVars.push({
          key,
          old: oldVal,
          new: newVal,
          formatOnly: isFormatOnly
        })
      } else {
        unchangedVars.push(key)
      }
    }
  }

  // Check for deleted vars (filter out Vercel system variables)
  const systemVarPatterns = [/^VERCEL_/, /^TURBO_/, /^NX_/]
  for (const key of vercelKeys) {
    if (!localKeys.has(key)) {
      // Skip system variables
      const isSystemVar = systemVarPatterns.some(pattern => pattern.test(key))
      if (!isSystemVar) {
        deletedVars.push(key)
      }
    }
  }

  // Display diff
  console.log('\n' + '=' .repeat(70))
  console.log('📊 Environment Variables Diff')
  console.log('=' .repeat(70))

  if (newVars.length > 0) {
    console.log(`\n✅ New variables (${newVars.length}):\n`)
    newVars.forEach(({ key, value }) => {
      const isSensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(key)) &&
                          !PUBLIC_EXCEPTIONS.some(pattern => pattern.test(key))
      const displayValue = isSensitive
        ? value.substring(0, 8) + '***' + value.substring(value.length - 4)
        : value.length > 50 ? value.substring(0, 47) + '...' : value
      console.log(`   + ${key} = ${displayValue}`)
    })
  }

  if (modifiedVars.length > 0) {
    // Separate format-only changes from real changes
    const realChanges = modifiedVars.filter(v => !v.formatOnly)
    const formatChanges = modifiedVars.filter(v => v.formatOnly)

    if (realChanges.length > 0) {
      console.log(`\n🔄 Modified variables (${realChanges.length}):\n`)
      realChanges.forEach(({ key, old, new: newVal }) => {
        const isSensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(key)) &&
                            !PUBLIC_EXCEPTIONS.some(pattern => pattern.test(key))
        if (isSensitive) {
          console.log(`   ~ ${key}`)
          console.log(`     - Old: ${old.substring(0, 8)}***${old.substring(old.length - 4)}`)
          console.log(`     + New: ${newVal.substring(0, 8)}***${newVal.substring(newVal.length - 4)}`)
        } else {
          const displayOld = old.length > 40 ? old.substring(0, 37) + '...' : old
          const displayNew = newVal.length > 40 ? newVal.substring(0, 37) + '...' : newVal
          console.log(`   ~ ${key}`)
          console.log(`     - Old: ${displayOld}`)
          console.log(`     + New: ${displayNew}`)
        }
      })
    }

    // Only show format corrections if there are also real changes
    // (otherwise it's just noise from Vercel CLI's quote-adding behavior)
    if (formatChanges.length > 0 && realChanges.length > 0) {
      console.log(`\n🔧 Format corrections: ${formatChanges.length} variables with quote wrapping differences\n`)

      // Show one example to illustrate the problem
      const example = formatChanges[0]
      const isSensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(example.key)) &&
                          !PUBLIC_EXCEPTIONS.some(pattern => pattern.test(example.key))

      console.log(`   Example: ${example.key}`)
      if (isSensitive) {
        console.log(`     Vercel: ${example.old.substring(0, 12)}***${example.old.substring(example.old.length - 4)}`)
        console.log(`     Local:  ${example.new.substring(0, 12)}***${example.new.substring(example.new.length - 4)}`)
      } else {
        const displayOld = example.old.length > 45 ? example.old.substring(0, 42) + '...' : example.old
        const displayNew = example.new.length > 45 ? example.new.substring(0, 42) + '...' : example.new
        console.log(`     Vercel: ${displayOld}`)
        console.log(`     Local:  ${displayNew}`)
      }

      if (formatChanges.length > 1) {
        const otherVars = formatChanges.slice(1, 4).map(v => v.key).join(', ')
        const remaining = formatChanges.length - 4
        console.log(`   Also: ${otherVars}${remaining > 0 ? `, +${remaining} more` : ''}`)
      }
      console.log('')
    }
  }

  if (deletedVars.length > 0) {
    console.log(`\n⚠️  Variables only in Vercel (${deletedVars.length}) - will remain unchanged:\n`)
    deletedVars.forEach(key => {
      console.log(`   ! ${key}`)
    })
    console.log(`\n   💡 Note: These won't be deleted, just not managed locally`)
  }

  if (unchangedVars.length > 0) {
    console.log(`\n💡 Unchanged variables: ${unchangedVars.length}`)
  }

  console.log('\n' + '=' .repeat(70))

  // Summary
  const realChanges = modifiedVars.filter(v => !v.formatOnly)
  const formatChanges = modifiedVars.filter(v => v.formatOnly)
  const totalChanges = newVars.length + realChanges.length

  // Treat format-only changes as "no changes" when there are no new/modified variables
  if (totalChanges === 0) {
    console.log('\n✅ No changes detected - all variables are up to date\n')

    if (formatChanges.length > 0) {
      console.log(`   💡 Note: ${formatChanges.length} variables have different quote formatting in Vercel,`)
      console.log(`      but values are identical. This is normal - Vercel CLI adds quotes when pulling.\n`)
    }

    return {
      hasChanges: false,
      stats: {
        new: 0,
        modified: 0,
        formatOnly: formatChanges.length,
        deleted: 0,
        unchanged: unchangedVars.length
      },
      newVars: [],
      modifiedVars: [],
      unchangedVars
    }
  } else {
    const parts = []
    if (newVars.length > 0) parts.push(`${newVars.length} new`)
    if (realChanges.length > 0) parts.push(`${realChanges.length} modified`)
    if (formatChanges.length > 0) parts.push(`${formatChanges.length} format fixes`)

    console.log(`\n📊 Summary: ${parts.join(' | ')}\n`)
    return {
      hasChanges: true,
      stats: {
        new: newVars.length,
        modified: realChanges.length,
        formatOnly: formatChanges.length,
        deleted: deletedVars.length,
        unchanged: unchangedVars.length
      },
      newVars,
      modifiedVars: realChanges,
      unchangedVars
    }
  }
}

// ============================================================================
// Deployment
// ============================================================================

async function deployToVercel(projectConfig) {
  console.log(`\n🚀 Deploying to Vercel (${projectConfig.env})...\n`)

  try {
    // Step 1: Deploy with visible output (inheritStdio shows progress)
    const args = projectConfig.env === 'production' ? ['--prod'] : []
    await execCommand('vercel', args, null, { inheritStdio: true })

    console.log('\n   ✅ Deployment successful!\n')

    // Step 2: Get the most recent deployment URL
    console.log('   📋 Retrieving deployment URL...\n')
    const { stdout } = await execCommand('vercel', ['ls'])

    // Parse text output to find first deployment URL
    // Format: "  16m     https://nextspark-xyz-the-money-team.vercel.app     ● Ready"
    const lines = stdout.split('\n')
    const urlLine = lines.find(line => line.includes('https://'))

    if (urlLine) {
      const urlMatch = urlLine.match(/(https:\/\/[^\s]+)/)
      if (urlMatch) {
        const deploymentUrl = urlMatch[1]
        console.log(`   🔗 Deployment URL: ${deploymentUrl}\n`)
        return { success: true, url: deploymentUrl }
      }
    }

    console.log('   ⚠️  Could not retrieve deployment URL\n')
    return { success: true, url: null }
  } catch (error) {
    console.error('\n   ❌ Deployment failed\n')
    return { success: false, url: null }
  }
}

/**
 * Assign a custom domain alias to a deployment
 * Only used when --deploy flag is provided (manual deployment)
 */
async function assignAlias(deploymentUrl, domain) {
  console.log(`\n🔗 Assigning custom domain to deployment...`)
  console.log(`   Deployment: ${deploymentUrl}`)
  console.log(`   Domain: ${domain}\n`)

  try {
    await execCommand('vercel', ['alias', 'set', deploymentUrl, domain])
    console.log(`   ✅ Successfully assigned: ${domain} → ${deploymentUrl}\n`)
    return true
  } catch (error) {
    console.error(`   ❌ Failed to assign alias: ${error.message}\n`)
    return false
  }
}

// ============================================================================
// Main Workflow
// ============================================================================

async function main() {
  const args = process.argv.slice(2)
  const hasProd = args.includes('--prod')
  const hasStaging = args.includes('--staging')
  const skipEnv = args.includes('--skip-env')
  const shouldDeploy = args.includes('--deploy')

  // Validate required flag
  if (!hasProd && !hasStaging) {
    console.log('=' .repeat(70))
    console.log('🚀 Vercel Deployment Script')
    console.log('=' .repeat(70))
    console.error('\n❌ Error: You must specify a deployment target')
    console.log('\nUsage:')
    console.log('  pnpm vercel:deploy --staging              # Setup only (recommended)')
    console.log('  pnpm vercel:deploy --staging --deploy     # Setup + manual deploy')
    console.log('  pnpm vercel:deploy --prod                 # Deploy to production')
    console.log('  pnpm vercel:deploy --prod --skip-env      # Deploy without updating env vars')
    console.log('\n' + '=' .repeat(70))
    process.exit(1)
  }

  // Prevent conflicting flags
  if (hasProd && hasStaging) {
    console.error('\n❌ Error: Cannot specify both --prod and --staging')
    process.exit(1)
  }

  // Normalize target names to match Vercel environment names for consistency
  const target = hasProd ? 'production' : 'staging'
  const projectConfig = getProjectConfig(target)

  console.log('=' .repeat(70))
  console.log('🚀 Vercel Deployment Workflow')
  console.log('=' .repeat(70))
  console.log(`   Target: ${target.toUpperCase()}`)
  console.log(`   Project: ${projectConfig.name}`)
  console.log(`   Environment: ${target === 'staging' ? 'staging (detecting custom environment...)' : projectConfig.env}`)
  console.log(`   URL: ${projectConfig.url}`)
  console.log('=' .repeat(70))

  // Step 1: Merge local env files
  const mergeResult = mergeEnvironmentVariables(target)
  projectConfig.mergedEnvFile = mergeResult.outputPath

  // Step 2: Validate Vercel setup
  console.log('\n📋 Validating Vercel setup...\n')
  await checkVercelCLI()
  await checkVercelAuth()
  await checkProjectLink(projectConfig)

  // Step 2.5: For staging, ensure custom environment and domain are configured
  let customEnvironment = null
  if (target === 'staging') {
    // First, ensure the custom environment exists
    customEnvironment = await ensureCustomEnvironment(projectConfig)

    // CRITICAL: Update projectConfig to use the custom environment slug
    // This ensures all subsequent operations (env pull, upload, deploy) target the correct environment
    if (customEnvironment) {
      projectConfig.env = customEnvironment.slug // "staging" instead of "preview"
      projectConfig.isCustomEnvironment = true
      console.log(`   🎯 Using custom environment: ${customEnvironment.slug}\n`)
    }

    // Then, configure the domain with the custom environment
    await ensureStagingDomain(projectConfig, customEnvironment)

    // Log completion of custom environment setup
    console.log('   ✅ Custom environment setup complete\n')
  }

  // Step 3: Pull current Vercel env vars (for comparison)
  console.log('=' .repeat(70))
  console.log('📋 Environment Variables Configuration')
  console.log('=' .repeat(70))
  await pullEnvironmentVariables(projectConfig)

  // Step 4: Upload merged env vars (with confirmation)
  console.log('\n' + '=' .repeat(70))
  console.log('📤 Step 4: Environment Variable Upload')
  console.log('=' .repeat(70))

  let uploadSuccess = true

  if (skipEnv) {
    console.log('\n⏭️  Skipping environment variable update (--skip-env flag)\n')
  } else {
    // Show diff between current Vercel vars and new local vars
    console.log('\n📊 Analyzing environment variable changes...\n')
    const diffResult = showEnvDiff(projectConfig)

    // If no changes, skip the upload automatically
    if (!diffResult.hasChanges) {
      console.log('\n✅ All environment variables are already up to date in Vercel')
      console.log('   ⏭️  Skipping upload step (no changes to push)\n')
    } else {
      // Ask user if they want to update env vars
      console.log('=' .repeat(70))
      console.log('📋 Confirm Environment Variable Update')
      console.log('=' .repeat(70))
      console.log(`\n   Target: ${projectConfig.name} (${projectConfig.env})`)

      const changeParts = []
      if (diffResult.stats.new > 0) changeParts.push(`${diffResult.stats.new} new`)
      if (diffResult.stats.modified > 0) changeParts.push(`${diffResult.stats.modified} modified`)
      if (diffResult.stats.formatOnly > 0) changeParts.push(`${diffResult.stats.formatOnly} format fixes`)

      console.log(`   Changes: ${changeParts.join(', ')}`)

      if (diffResult.stats.modified > 0) {
        console.log(`\n   ⚠️  Warning: This will overwrite ${diffResult.stats.modified} existing variable(s) on Vercel`)
      }
      if (diffResult.stats.formatOnly > 0) {
        console.log(`   💡 Note: ${diffResult.stats.formatOnly} variables have same value but incorrect quote format`)
      }
      console.log('')

      const shouldUpdateEnv = await confirm('   Proceed with environment variable update')

      if (shouldUpdateEnv) {
        // Pass custom environment slug if deploying to staging
        const customEnvSlug = customEnvironment ? customEnvironment.slug : null
        uploadSuccess = await uploadVariables(projectConfig, customEnvSlug, diffResult)

        if (!uploadSuccess) {
          const shouldContinue = await confirm('\n   Some uploads failed. Continue with deployment')
          if (!shouldContinue) {
            console.log('\n   ❌ Deployment cancelled\n')
            process.exit(1)
          }
        }
      } else {
        console.log('\n   ⏭️  Skipping environment variable update')
        console.log('   📝 Note: Deployment will use existing Vercel env vars\n')
      }
    }
  }

  // Step 5: Deploy (optional with --deploy flag)
  if (shouldDeploy) {
    console.log('\n' + '=' .repeat(70))
    console.log('🚀 Step 5: Vercel Deployment')
    console.log('=' .repeat(70))
    const shouldProceed = await confirm('   Proceed with deployment')

    if (!shouldProceed) {
      console.log('\n   ❌ Deployment cancelled\n')
      process.exit(0)
    }

    const deployResult = await deployToVercel(projectConfig)

    if (deployResult.success) {
      // Step 6: Assign alias for manual deployments
      let finalUrl = deployResult.url

      if (deployResult.url) {
        // For staging, use the pre-configured stagingDomain
        // For production, read from .env.production
        let customDomain = null

        if (target === 'staging' && projectConfig.stagingDomain) {
          customDomain = projectConfig.stagingDomain
        } else {
          // Read from environment file
          const envFile = target === 'staging' ? '.env.staging' : '.env.production'
          const envPath = join(projectRoot, envFile)

          if (existsSync(envPath)) {
            const envContent = readFileSync(envPath, 'utf-8')
            const urlMatch = envContent.match(/^NEXT_PUBLIC_APP_URL\s*=\s*['"]?https?:\/\/([^'"\n]+)['"]?/m)
            if (urlMatch) {
              customDomain = urlMatch[1].trim()
            }
          }
        }

        if (customDomain) {
          const aliasSuccess = await assignAlias(deployResult.url, customDomain)

          if (aliasSuccess) {
            finalUrl = `https://${customDomain}`
            console.log(`   🌐 Custom domain active: https://${customDomain}\n`)
          } else {
            console.log(`   ⚠️  Warning: ${target} deployment successful but alias assignment failed`)
            console.log(`   Manual command: vercel alias set ${deployResult.url} ${customDomain}\n`)
          }
        } else {
          if (target === 'staging') {
            console.log(`\n   ⚠️  No staging domain configured`)
            console.log(`   💡 Add NEXT_PUBLIC_APP_URL to .env.staging for custom domain setup\n`)
          }
        }
      }

      console.log('=' .repeat(70))
      console.log('🎉 Deployment Complete!')
      console.log('=' .repeat(70))
      console.log(`\n   Environment: ${target.toUpperCase()}`)
      console.log(`   Project: ${projectConfig.name}`)
      console.log(`   Vercel Dashboard: ${projectConfig.url}`)

      if (finalUrl) {
        console.log(`\n   🚀 Live URL: ${finalUrl}`)
      }
      if (deployResult.url && deployResult.url !== finalUrl) {
        console.log(`   📋 Deployment URL: ${deployResult.url}`)
      }
      console.log('')
    } else {
      process.exit(1)
    }
  } else {
    // Setup complete - no deployment
    console.log('\n' + '=' .repeat(70))
    console.log('✅ Setup Complete!')
    console.log('=' .repeat(70))
    console.log(`\n   Environment: ${target.toUpperCase()}`)
    console.log(`   Project: ${projectConfig.name}`)
    console.log(`   Custom Environment: staging (with Branch Tracking)`)
    if (projectConfig.stagingDomain) {
      console.log(`   Domain: ${projectConfig.stagingDomain}`)
    }
    console.log(`\n   💡 Next steps:`)
    console.log(`      1. git add . && git commit -m "Update staging config"`)
    console.log(`      2. git push origin staging`)
    console.log(`      3. Branch Tracking will auto-deploy and assign domain\n`)
    console.log(`   Or run with --deploy flag for manual deployment:\n`)
    console.log(`      pnpm vercel:deploy --staging --deploy\n`)
    console.log('=' .repeat(70))
    console.log('')
  }
}

// ============================================================================
// Run
// ============================================================================

main().catch(error => {
  console.error('❌ Fatal error:', error.message)
  process.exit(1)
})
