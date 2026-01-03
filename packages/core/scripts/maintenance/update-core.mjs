#!/usr/bin/env node
/**
 * NextSpark Core Updater v3.0
 *
 * Updates core framework files while preserving user customizations.
 * Downloads the latest release, copies core files, and preserves user data.
 *
 * Usage:
 *   pnpm update-core                            # Update to latest
 *   pnpm update-core --version v2.0.0           # Specific version
 *   pnpm update-core --branch                   # Create update branch
 *   pnpm update-core --list                     # List releases
 *   pnpm update-core --check                    # Check for updates
 *   pnpm update-core --current                  # Show current version
 *   pnpm update-core --help                     # Show help
 */

import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'
import https from 'https'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import AdmZip from 'adm-zip'
import dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

// ==================== CONSTANTS ====================

// Default repository (fallback if core.version.json doesn't exist)
const DEFAULT_CORE_REPO = 'NextSpark-dev/nextspark'

// Core plugins that should be updated (hardcoded)
const CORE_PLUGINS = ['ai', 'amplitude', 'social-media-publisher']

// Only theme that should be updated
const CORE_THEME = 'default'

// Root files that should be overwritten
const ROOT_FILES_TO_COPY = [
  'middleware.ts',
  'next.config.ts',
  'jest.config.ts',
  'eslint.config.mjs',
  'postcss.config.mjs',
  'tsconfig.base.json',
  'tsconfig.test.json',
  'turbo.json',
  'components.json',
  'vercel.json',
  'package.json'
]

// Directories that should be completely overwritten
const DIRECTORIES_TO_COPY = [
  'core',
  'app',
  '.rules'
]

// Paths that should NEVER be overwritten (user files)
const PROTECTED_PATHS = [
  // Environment files
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  '.env.backup',
  '.env.prod',
  '.env.staging',
  '.env.vercel',
  '.env.example',
  // User content
  'contents',              // Managed separately (only default theme + core plugins)
  'public/uploads',        // User uploads
  'supabase',              // Local DB
  // Project-specific docs
  'CLAUDE.md',
  'README.md',
  'DEPLOYMENT.md',
  // Claude workflow
  '.claude',
  // Git and dependencies
  '.git',
  'node_modules',
  '.next',
  'pnpm-lock.yaml',
  'package-lock.json',
  // Version file (updated at the end)
  'core.version.json',
  // Auto-generated
  'tsconfig.json',
  'tsconfig.tsbuildinfo',
  // Temp files
  '.tmp-core-update',
  '.tmp-core-update.zip',
  // IDE and other
  '.idea',
  '.cursor',
  '.vercel',
  '.turbo',
  '_tmp',
  'coverage'
]

// ==================== ARGUMENT PARSER ====================

/**
 * Parse command line arguments into flags object
 */
function parseArguments(args) {
  const flags = {
    version: null,
    list: false,
    check: false,
    current: false,
    help: false,
    latest: true,
    branch: false
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--version' || arg === '-v') {
      flags.version = args[++i]
      flags.latest = false
    }
    else if (arg.startsWith('--version=')) {
      flags.version = arg.split('=')[1]
      flags.latest = false
    }
    else if (arg === '--list') flags.list = true
    else if (arg === '--check') flags.check = true
    else if (arg === '--current') flags.current = true
    else if (arg === '--latest') flags.latest = true
    else if (arg === '--branch' || arg === '-b') flags.branch = true
    else if (arg === '--help' || arg === '-h') flags.help = true
  }

  return flags
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Read current core version from core.version.json
 */
async function getCurrentVersion() {
  try {
    const versionFile = await fs.readFile('core.version.json', 'utf8')
    const data = JSON.parse(versionFile)
    return data.version
  } catch {
    return 'unknown'
  }
}

/**
 * Get full version info including update date
 */
async function getVersionInfo() {
  try {
    const versionFile = await fs.readFile('core.version.json', 'utf8')
    return JSON.parse(versionFile)
  } catch {
    return {
      version: 'unknown',
      updatedAt: null,
      releaseUrl: null,
      previousVersion: null
    }
  }
}

/**
 * Get core repository from core.version.json
 */
async function getCoreRepository() {
  try {
    const versionFile = await fs.readFile('core.version.json', 'utf8')
    const data = JSON.parse(versionFile)
    return data.repository || DEFAULT_CORE_REPO
  } catch {
    return DEFAULT_CORE_REPO
  }
}

/**
 * Update core.version.json with new version info
 */
async function updateVersionFile(releaseInfo, previousVersion) {
  // Preserve existing repository value
  const repository = await getCoreRepository()

  const versionData = {
    version: releaseInfo.tag_name,
    updatedAt: new Date().toISOString(),
    releaseUrl: releaseInfo.html_url,
    previousVersion: previousVersion,
    repository: repository
  }

  await fs.writeFile(
    'core.version.json',
    JSON.stringify(versionData, null, 2) + '\n'
  )

  console.log(`   ${previousVersion} -> ${releaseInfo.tag_name}`)
}

/**
 * Create initial core.version.json if it doesn't exist
 */
async function ensureVersionFile() {
  try {
    await fs.access('core.version.json')
  } catch {
    // File doesn't exist, create it
    const versionData = {
      version: 'unknown',
      updatedAt: new Date().toISOString(),
      releaseUrl: null,
      previousVersion: null,
      repository: DEFAULT_CORE_REPO
    }

    await fs.writeFile(
      'core.version.json',
      JSON.stringify(versionData, null, 2) + '\n'
    )

    console.log('   Created core.version.json (initial setup)')
  }
}

/**
 * Fetch release information from GitHub
 */
async function fetchReleaseInfo(version = 'latest') {
  const CORE_REPO = await getCoreRepository()
  const url = version === 'latest'
    ? `https://api.github.com/repos/${CORE_REPO}/releases/latest`
    : `https://api.github.com/repos/${CORE_REPO}/releases/tags/${version}`

  // Headers for authentication (if repo is private)
  const headers = {
    'User-Agent': 'nextspark-updater'
  }

  // If there's a GitHub token in env (for private repos or better rate limits)
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = ''

      res.on('data', chunk => data += chunk)

      res.on('end', () => {
        if (res.statusCode === 401) {
          reject(new Error('GitHub authentication failed. Set GITHUB_TOKEN in .env for private repos.'))
        } else if (res.statusCode === 404) {
          reject(new Error(`Release not found: ${version}`))
        } else if (res.statusCode === 200) {
          resolve(JSON.parse(data))
        } else {
          reject(new Error(`Failed to fetch release: HTTP ${res.statusCode}`))
        }
      })
    }).on('error', reject)
  })
}

/**
 * Download file from URL
 */
async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'nextspark-updater',
        ...(process.env.GITHUB_TOKEN && {
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
        })
      }
    }, (res) => {
      // Handle redirects
      if (res.statusCode === 302 || res.statusCode === 301) {
        downloadFile(res.headers.location, dest)
          .then(resolve)
          .catch(reject)
        return
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${res.statusCode}`))
        return
      }

      const file = createWriteStream(dest)
      pipeline(res, file)
        .then(resolve)
        .catch(reject)
    }).on('error', reject)
  })
}

/**
 * Recursively copy directory
 */
async function copyRecursive(src, dest) {
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyRecursive(srcPath, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

/**
 * Remove directory if it exists
 */
async function removeIfExists(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true })
  } catch {
    // Ignore errors
  }
}

/**
 * Copy a directory from source to target, removing target first
 */
async function copyDirectory(sourceDir, targetDir, dirName) {
  const srcPath = path.join(sourceDir, dirName)
  const destPath = path.join(targetDir, dirName)

  // Check if source exists
  try {
    await fs.access(srcPath)
  } catch {
    console.log(`   Skipped ${dirName}/ (not in source)`)
    return 0
  }

  // Remove existing and copy new
  await removeIfExists(destPath)
  await copyRecursive(srcPath, destPath)

  // Count files
  let count = 0
  async function countFiles(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await countFiles(path.join(dir, entry.name))
      } else {
        count++
      }
    }
  }
  await countFiles(destPath)

  return count
}

/**
 * Copy root files from source to target
 */
async function copyRootFiles(sourceDir, targetDir) {
  let copied = 0
  let skipped = 0

  for (const fileName of ROOT_FILES_TO_COPY) {
    const srcPath = path.join(sourceDir, fileName)
    const destPath = path.join(targetDir, fileName)

    try {
      await fs.access(srcPath)
      await fs.copyFile(srcPath, destPath)
      copied++
    } catch {
      skipped++
    }
  }

  return { copied, skipped }
}

/**
 * Copy only the default theme
 */
async function copyDefaultTheme(sourceDir, targetDir) {
  const srcPath = path.join(sourceDir, 'contents', 'themes', CORE_THEME)
  const destPath = path.join(targetDir, 'contents', 'themes', CORE_THEME)

  try {
    await fs.access(srcPath)
  } catch {
    console.log(`   Skipped theme/${CORE_THEME} (not in source)`)
    return 0
  }

  await removeIfExists(destPath)
  await copyRecursive(srcPath, destPath)

  // Count files
  let count = 0
  async function countFiles(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await countFiles(path.join(dir, entry.name))
      } else {
        count++
      }
    }
  }
  await countFiles(destPath)

  return count
}

/**
 * Copy core plugins
 */
async function copyCorePlugins(sourceDir, targetDir) {
  let totalFiles = 0
  const copied = []
  const skipped = []

  for (const pluginName of CORE_PLUGINS) {
    const srcPath = path.join(sourceDir, 'contents', 'plugins', pluginName)
    const destPath = path.join(targetDir, 'contents', 'plugins', pluginName)

    try {
      await fs.access(srcPath)
    } catch {
      skipped.push(pluginName)
      continue
    }

    await removeIfExists(destPath)
    await copyRecursive(srcPath, destPath)
    copied.push(pluginName)

    // Count files
    async function countFiles(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await countFiles(path.join(dir, entry.name))
        } else {
          totalFiles++
        }
      }
    }
    await countFiles(destPath)
  }

  return { totalFiles, copied, skipped }
}

/**
 * Check for new database migrations
 */
async function checkNewMigrations(projectRoot) {
  const migrationsDir = path.join(projectRoot, 'core', 'migrations')

  try {
    const files = await fs.readdir(migrationsDir)
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort()
    return sqlFiles
  } catch {
    return []
  }
}

/**
 * List available releases from GitHub
 */
async function listReleases() {
  const currentVersion = await getCurrentVersion()
  const CORE_REPO = await getCoreRepository()

  console.log('Fetching available releases...\n')

  const response = await fetch(
    `https://api.github.com/repos/${CORE_REPO}/releases`,
    {
      headers: {
        'User-Agent': 'nextspark-updater',
        ...(process.env.GITHUB_TOKEN && {
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
        })
      }
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch releases: HTTP ${response.status}`)
  }

  const releases = await response.json()

  console.log('Available releases:\n')
  releases.forEach((release, index) => {
    const isLatest = index === 0 ? ' (latest)' : ''
    const isCurrent = release.tag_name === currentVersion ? ' <- installed' : ''
    const date = new Date(release.published_at).toLocaleDateString()
    console.log(`  ${release.tag_name}${isLatest}${isCurrent} - ${date}`)
  })
}

/**
 * Check if updates are available
 */
async function checkUpdates() {
  const current = await getCurrentVersion()
  const latestInfo = await fetchReleaseInfo('latest')

  // Normalize versions for comparison (remove 'v' prefix if present)
  const currentNormalized = current.replace(/^v/, '')
  const latestNormalized = latestInfo.tag_name.replace(/^v/, '')

  console.log(`Current: ${current}`)
  console.log(`Latest:  ${latestInfo.tag_name}`)

  if (currentNormalized !== latestNormalized) {
    console.log(`\nUpdate available! Run: pnpm update-core`)
  } else {
    console.log(`\nYou're up to date!`)
  }
}

/**
 * Show current version
 */
async function showVersion() {
  const versionInfo = await getVersionInfo()

  if (versionInfo.updatedAt) {
    const date = new Date(versionInfo.updatedAt).toLocaleDateString()
    console.log(`Core ${versionInfo.version} (updated ${date})`)
  } else {
    console.log(`Core ${versionInfo.version}`)
  }
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
NextSpark Core Updater v3.0

Usage:
  pnpm update-core [options]

Options:
  --version <version>     Update to specific version (e.g., v2.0.0)
  --latest                Update to latest version (default)
  --branch, -b            Create update branch before applying changes
  --list                  List available releases
  --check                 Check for updates
  --current               Show current version
  --help, -h              Show this help message

What gets updated:
  /core/                  Core framework (complete overwrite)
  /app/                   App routes and pages (complete overwrite)
  /.rules/                Development rules (complete overwrite)
  /contents/themes/default/   Default theme only
  /contents/plugins/{core}/   Core plugins: ${CORE_PLUGINS.join(', ')}
  Root config files       middleware.ts, next.config.ts, package.json, etc.

What is preserved:
  .env*                   Environment files
  .claude/                Claude workflow
  supabase/               Local database
  public/uploads/         User uploads
  CLAUDE.md, README.md    Project documentation
  /contents/themes/*      Custom themes (except default)
  /contents/plugins/*     Custom plugins (except core)

Examples:
  pnpm update-core                    # Update to latest
  pnpm update-core --branch           # Update in new branch
  pnpm update-core --version v2.5.0   # Specific version
  pnpm update-core --list             # List releases
  pnpm update-core --check            # Check for updates
  `)
  process.exit(0)
}

// ==================== MAIN UPDATE FUNCTION ====================

async function updateCore() {
  const args = process.argv.slice(2)
  const flags = parseArguments(args)

  // Handle info commands
  if (flags.help) return showHelp()
  if (flags.list) return listReleases()
  if (flags.check) return checkUpdates()
  if (flags.current) return showVersion()

  console.log('\n========================================')
  console.log('  NextSpark Core Updater v3.0')
  console.log('========================================\n')

  const projectRoot = process.cwd()

  // 1. Pre-flight checks
  console.log('[1/9] Pre-flight checks...')
  try {
    await fs.access(path.join(projectRoot, 'package.json'))
    console.log('   Found package.json')
  } catch {
    console.error('   ERROR: No package.json found. Run from project root.')
    process.exit(1)
  }

  // Ensure version file exists
  await ensureVersionFile()

  // Get current version
  const previousVersion = await getCurrentVersion()
  console.log(`   Current version: ${previousVersion}\n`)

  // Check for uncommitted changes
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' })
    if (status.trim()) {
      console.error('   ERROR: Uncommitted changes detected.')
      console.error('   Commit or stash your changes first.')
      console.error('   Run: git status')
      process.exit(1)
    }
    console.log('   Git status: clean')
  } catch (error) {
    console.warn('   Warning: Not a git repository\n')
  }

  // 2. Create safety snapshot
  console.log('\n[2/9] Creating safety snapshot...')
  const targetVersion = flags.version || 'latest'
  try {
    const timestamp = Date.now()
    execSync(
      `git add -A && git commit -m "Pre-update snapshot (${targetVersion})" --allow-empty`,
      { stdio: 'ignore' }
    )
    execSync(`git tag pre-update-${targetVersion}-${timestamp}`, { stdio: 'ignore' })
    console.log(`   Tag: pre-update-${targetVersion}-${timestamp}`)
  } catch {
    console.log('   Skipped (not a git repo)')
  }

  // 3. Fetch release info
  console.log('\n[3/9] Fetching release info...')
  const releaseInfo = await fetchReleaseInfo(targetVersion)
  const publishedDate = new Date(releaseInfo.published_at).toLocaleDateString()
  console.log(`   Version: ${releaseInfo.tag_name}`)
  console.log(`   Published: ${publishedDate}`)

  // 4. Download ZIP
  console.log('\n[4/9] Downloading release...')
  const zipPath = path.join(projectRoot, '.tmp-core-update.zip')
  await downloadFile(releaseInfo.zipball_url, zipPath)
  console.log('   Downloaded')

  // 5. Extract
  console.log('\n[5/9] Extracting...')
  const tmpDir = path.join(projectRoot, '.tmp-core-update')
  await fs.mkdir(tmpDir, { recursive: true })

  const zip = new AdmZip(zipPath)
  zip.extractAllTo(tmpDir, true)

  const extractedDirs = await fs.readdir(tmpDir)
  const sourceDir = path.join(tmpDir, extractedDirs[0])
  console.log('   Extracted to temp directory')

  // 6. Create update branch if requested
  if (flags.branch) {
    console.log('\n[5.5/9] Creating update branch...')

    const versionSlug = releaseInfo.tag_name.replace(/^v/, '').replace(/\./g, '-')
    const branchName = `update/${versionSlug}`

    try {
      execSync('git rev-parse --git-dir', { stdio: 'ignore' })

      try {
        execSync(`git rev-parse --verify ${branchName}`, { stdio: 'ignore' })
        console.error(`   ERROR: Branch '${branchName}' already exists`)
        console.error(`   Delete it first: git branch -D ${branchName}`)

        await fs.rm(tmpDir, { recursive: true, force: true })
        await fs.rm(zipPath, { force: true })
        process.exit(1)
      } catch {
        // Branch doesn't exist - good
      }

      execSync(`git checkout -b ${branchName}`, { stdio: 'inherit' })
      console.log(`   Created branch: ${branchName}`)
    } catch (error) {
      console.error('   ERROR: Could not create git branch')
      await fs.rm(tmpDir, { recursive: true, force: true })
      await fs.rm(zipPath, { force: true })
      process.exit(1)
    }
  }

  // 7. Copy files
  console.log('\n[6/9] Copying files...')

  // Copy main directories
  let totalFiles = 0
  for (const dirName of DIRECTORIES_TO_COPY) {
    const count = await copyDirectory(sourceDir, projectRoot, dirName)
    console.log(`   ${dirName}/ - ${count} files`)
    totalFiles += count
  }

  // Copy root files
  const rootFilesResult = await copyRootFiles(sourceDir, projectRoot)
  console.log(`   Root files - ${rootFilesResult.copied} copied, ${rootFilesResult.skipped} skipped`)
  totalFiles += rootFilesResult.copied

  // Copy default theme
  console.log('\n[7/9] Updating theme and plugins...')
  const themeFiles = await copyDefaultTheme(sourceDir, projectRoot)
  console.log(`   themes/${CORE_THEME}/ - ${themeFiles} files`)
  totalFiles += themeFiles

  // Copy core plugins
  const pluginsResult = await copyCorePlugins(sourceDir, projectRoot)
  if (pluginsResult.copied.length > 0) {
    console.log(`   plugins/ - ${pluginsResult.copied.join(', ')} (${pluginsResult.totalFiles} files)`)
  }
  if (pluginsResult.skipped.length > 0) {
    console.log(`   plugins/ skipped - ${pluginsResult.skipped.join(', ')} (not in source)`)
  }
  totalFiles += pluginsResult.totalFiles

  // 8. Cleanup temp files
  console.log('\n[8/9] Cleaning up...')
  await fs.rm(tmpDir, { recursive: true, force: true })
  await fs.rm(zipPath, { force: true })
  console.log('   Temp files removed')

  // 9. Post-update tasks
  console.log('\n[9/9] Post-update tasks...')

  // Clear cache
  await fs.rm(path.join(projectRoot, '.next'), { recursive: true, force: true }).catch(() => {})
  console.log('   Cache cleared')

  // Install dependencies
  console.log('   Installing dependencies...')
  execSync('pnpm install', { stdio: 'inherit' })

  // Rebuild registries
  console.log('   Rebuilding registries...')
  try {
    execSync('node core/scripts/build/registry.mjs --build', { stdio: 'inherit' })
  } catch (error) {
    console.error('   Warning: Registry rebuild failed')
  }

  try {
    execSync('pnpm docs:build', { stdio: 'ignore' })
    console.log('   Docs registry rebuilt')
  } catch {}

  try {
    execSync('node core/scripts/build/theme.mjs', { stdio: 'ignore' })
    console.log('   Theme assets rebuilt')
  } catch {}

  // Check migrations
  const migrations = await checkNewMigrations(projectRoot)
  if (migrations.length > 0) {
    console.log(`\n   Database migrations found: ${migrations.length}`)
    console.log('   Run: pnpm db:migrate')
  }

  // Update version file
  console.log('\n   Updating version...')
  await updateVersionFile(releaseInfo, previousVersion)

  // Final report
  console.log('\n========================================')
  console.log('  Update Complete!')
  console.log('========================================')
  console.log(`\n  ${previousVersion} -> ${releaseInfo.tag_name}`)
  console.log(`  ${totalFiles} files updated`)

  if (flags.branch) {
    const versionSlug = releaseInfo.tag_name.replace(/^v/, '').replace(/\./g, '-')
    const branchName = `update/${versionSlug}`
    console.log(`\n  Branch: ${branchName}`)
    console.log('\n  Next steps:')
    console.log(`    1. Review: git diff main..${branchName}`)
    console.log('    2. Test: pnpm dev')
    if (migrations.length > 0) {
      console.log('    3. Migrate: pnpm db:migrate')
      console.log(`    4. Merge: git checkout main && git merge ${branchName}`)
    } else {
      console.log(`    3. Merge: git checkout main && git merge ${branchName}`)
    }
    console.log(`\n  Rollback: git checkout main && git branch -D ${branchName}`)
  } else {
    console.log('\n  Next steps:')
    console.log('    1. Review: git diff HEAD~1')
    console.log('    2. Test: pnpm dev')
    if (migrations.length > 0) {
      console.log('    3. Migrate: pnpm db:migrate')
    }
    console.log('\n  Rollback: git reset --hard HEAD~1 && pnpm install')
  }

  console.log('')
}

// ==================== CLI ENTRY POINT ====================

updateCore().catch(error => {
  console.error('\nUpdate failed:', error.message)
  console.error('\nRollback: git reset --hard HEAD~1 && pnpm install')
  process.exit(1)
})
