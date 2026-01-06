/**
 * Config Generator
 *
 * Generates and updates configuration files based on wizard responses.
 */

import fs from 'fs-extra'
import path from 'path'
import type { WizardConfig } from '../types.js'

/**
 * Get the target themes directory in the user's project
 */
function getTargetThemesDir(): string {
  return path.resolve(process.cwd(), 'contents', 'themes')
}

/**
 * Update authentication config based on wizard responses
 * Note: Only email/password and Google OAuth are currently supported
 */
export async function updateAuthConfig(config: WizardConfig): Promise<void> {
  const authConfigPath = path.join(
    getTargetThemesDir(),
    config.projectSlug,
    'config',
    'auth.config.ts'
  )

  if (!await fs.pathExists(authConfigPath)) {
    return
  }

  let content = await fs.readFile(authConfigPath, 'utf-8')

  // Update email/password enabled
  content = content.replace(
    /(emailPassword:\s*{[^}]*enabled:\s*)(?:true|false)/gs,
    `$1${config.auth.emailPassword}`
  )

  // Update Google OAuth enabled
  content = content.replace(
    /(google:\s*{[^}]*enabled:\s*)(?:true|false)/gs,
    `$1${config.auth.googleOAuth}`
  )

  // Update email verification
  content = content.replace(
    /(emailVerification:\s*)(?:true|false)/g,
    `$1${config.auth.emailVerification}`
  )

  await fs.writeFile(authConfigPath, content, 'utf-8')
}

/**
 * Update dashboard UI config based on wizard responses
 */
export async function updateDashboardUIConfig(config: WizardConfig): Promise<void> {
  const dashboardConfigPath = path.join(
    getTargetThemesDir(),
    config.projectSlug,
    'config',
    'dashboard.config.ts'
  )

  if (!await fs.pathExists(dashboardConfigPath)) {
    return
  }

  let content = await fs.readFile(dashboardConfigPath, 'utf-8')

  // Update search enabled
  content = content.replace(
    /(search:\s*{[^}]*enabled:\s*)(?:true|false)/gs,
    `$1${config.dashboard.search}`
  )

  // Update notifications enabled
  content = content.replace(
    /(notifications:\s*{[^}]*enabled:\s*)(?:true|false)/gs,
    `$1${config.dashboard.notifications}`
  )

  // Update theme toggle enabled
  content = content.replace(
    /(themeToggle:\s*{[^}]*enabled:\s*)(?:true|false)/gs,
    `$1${config.dashboard.themeToggle}`
  )

  // Update support enabled
  content = content.replace(
    /(support:\s*{[^}]*enabled:\s*)(?:true|false)/gs,
    `$1${config.dashboard.support}`
  )

  // Update quickCreate enabled
  content = content.replace(
    /(quickCreate:\s*{[^}]*enabled:\s*)(?:true|false)/gs,
    `$1${config.dashboard.quickCreate}`
  )

  // Update adminAccess enabled (mapped from wizard's superadminAccess)
  content = content.replace(
    /(adminAccess:\s*{[^}]*enabled:\s*)(?:true|false)/gs,
    `$1${config.dashboard.superadminAccess}`
  )

  // Update devtoolsAccess enabled
  content = content.replace(
    /(devtoolsAccess:\s*{[^}]*enabled:\s*)(?:true|false)/gs,
    `$1${config.dashboard.devtoolsAccess}`
  )

  // Update sidebar collapsed default
  content = content.replace(
    /(defaultCollapsed:\s*)(?:true|false)/g,
    `$1${config.dashboard.sidebarCollapsed}`
  )

  await fs.writeFile(dashboardConfigPath, content, 'utf-8')
}

/**
 * Update dev tools config based on wizard responses
 */
export async function updateDevToolsConfig(config: WizardConfig): Promise<void> {
  const devConfigPath = path.join(
    getTargetThemesDir(),
    config.projectSlug,
    'config',
    'dev.config.ts'
  )

  if (!await fs.pathExists(devConfigPath)) {
    return
  }

  let content = await fs.readFile(devConfigPath, 'utf-8')

  // Update dev keyring enabled
  content = content.replace(
    /(devKeyring:\s*{[^}]*enabled:\s*)(?:true|false)/gs,
    `$1${config.dev.devKeyring}`
  )

  // Update debug mode enabled
  content = content.replace(
    /(debugMode:\s*)(?:true|false)/g,
    `$1${config.dev.debugMode}`
  )

  await fs.writeFile(devConfigPath, content, 'utf-8')
}

/**
 * Generate permissions config based on team roles
 */
export async function updatePermissionsConfig(config: WizardConfig): Promise<void> {
  const permissionsConfigPath = path.join(
    getTargetThemesDir(),
    config.projectSlug,
    'config',
    'permissions.config.ts'
  )

  if (!await fs.pathExists(permissionsConfigPath)) {
    return
  }

  let content = await fs.readFile(permissionsConfigPath, 'utf-8')

  // Update role arrays in permissions based on selected roles
  const availableRoles = config.teamRoles

  // Build regex pattern to match role arrays
  // This updates roles: ['owner', 'admin', 'member', 'viewer'] patterns
  const roleArrayPattern = /roles:\s*\[(.*?)\]/g

  content = content.replace(roleArrayPattern, (match, rolesStr) => {
    // Parse current roles
    const currentRoles = rolesStr
      .split(',')
      .map((r: string) => r.trim().replace(/['"]/g, ''))
      .filter((r: string) => r.length > 0)

    // Filter to only include available roles
    const filteredRoles = currentRoles.filter((r: string) => availableRoles.includes(r))

    // If no roles remain, keep at least owner
    if (filteredRoles.length === 0) {
      filteredRoles.push('owner')
    }

    return `roles: [${filteredRoles.map((r: string) => `'${r}'`).join(', ')}]`
  })

  await fs.writeFile(permissionsConfigPath, content, 'utf-8')
}

/**
 * Update dashboard config with feature flags
 */
export async function updateDashboardConfig(config: WizardConfig): Promise<void> {
  const dashboardConfigPath = path.join(
    getTargetThemesDir(),
    config.projectSlug,
    'config',
    'dashboard.config.ts'
  )

  if (!await fs.pathExists(dashboardConfigPath)) {
    return
  }

  let content = await fs.readFile(dashboardConfigPath, 'utf-8')

  // Update analytics visibility
  if (!config.features.analytics) {
    // Comment out analytics-related navigation items or set enabled: false
    content = content.replace(
      /(id:\s*['"]analytics['"].*?enabled:\s*)true/gs,
      '$1false'
    )
  }

  // Update billing visibility
  if (!config.features.billing) {
    content = content.replace(
      /(id:\s*['"]billing['"].*?enabled:\s*)true/gs,
      '$1false'
    )
  }

  // Update teams visibility based on team mode
  if (config.teamMode === 'single-user') {
    content = content.replace(
      /(id:\s*['"]team['"].*?enabled:\s*)true/gs,
      '$1false'
    )
    content = content.replace(
      /(id:\s*['"]members['"].*?enabled:\s*)true/gs,
      '$1false'
    )
  }

  await fs.writeFile(dashboardConfigPath, content, 'utf-8')
}

/**
 * Generate .env.example file with project-specific values
 */
export async function generateEnvExample(config: WizardConfig): Promise<void> {
  const envExamplePath = path.resolve(process.cwd(), '.env.example')

  // Build OAuth section based on enabled providers
  let oauthSection = ''
  if (config.auth.googleOAuth) {
    oauthSection = `# =============================================================================
# OAUTH PROVIDERS
# =============================================================================
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
`
  } else {
    oauthSection = `# =============================================================================
# OAUTH (Optional - enable in auth.config.ts)
# =============================================================================
# GOOGLE_CLIENT_ID=""
# GOOGLE_CLIENT_SECRET=""
`
  }

  const envContent = `# NextSpark Environment Configuration
# Generated for: ${config.projectName}

# =============================================================================
# DATABASE
# =============================================================================
DATABASE_URL="postgresql://user:password@localhost:5432/database"

# =============================================================================
# AUTHENTICATION (better-auth)
# =============================================================================
# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET="your-secret-key-here"

# =============================================================================
# THEME
# =============================================================================
NEXT_PUBLIC_ACTIVE_THEME="${config.projectSlug}"

# =============================================================================
# APPLICATION
# =============================================================================
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"

${config.features.billing ? `# =============================================================================
# STRIPE (Billing)
# =============================================================================
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
` : '# Billing is disabled - no Stripe configuration needed'}

# =============================================================================
# EMAIL (Resend)
# =============================================================================
RESEND_API_KEY="re_..."

${oauthSection}`

  // Only create if it doesn't exist
  if (!await fs.pathExists(envExamplePath)) {
    await fs.writeFile(envExamplePath, envContent, 'utf-8')
  }
}

/**
 * Update README.md with project-specific information
 */
export async function updateReadme(config: WizardConfig): Promise<void> {
  const readmePath = path.join(getTargetThemesDir(), config.projectSlug, 'README.md')

  if (!await fs.pathExists(readmePath)) {
    return
  }

  let content = await fs.readFile(readmePath, 'utf-8')

  // Update title and description
  content = content.replace(/# Starter Theme/g, `# ${config.projectName}`)
  content = content.replace(
    /Minimal starter theme for NextSpark/g,
    config.projectDescription
  )

  await fs.writeFile(readmePath, content, 'utf-8')
}

/**
 * Copy .env.example to .env for immediate use
 * This allows the project to compile out-of-the-box
 */
export async function copyEnvExampleToEnv(): Promise<void> {
  const projectRoot = process.cwd()
  const envExamplePath = path.resolve(projectRoot, '.env.example')
  const envPath = path.resolve(projectRoot, '.env')

  if (await fs.pathExists(envExamplePath) && !await fs.pathExists(envPath)) {
    await fs.copy(envExamplePath, envPath)
  }
}
