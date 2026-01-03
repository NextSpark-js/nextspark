#!/usr/bin/env node
/**
 * NextSpark Version Release Script v2.0
 * 
 * Increments version following Semantic Versioning and creates Git tags.
 * 
 * Usage:
 *   pnpm release --patch        # Bug fixes (0.1.0 → 0.1.1)
 *   pnpm release --minor        # New features (0.1.0 → 0.2.0)
 *   pnpm release --major        # Breaking changes (0.1.0 → 1.0.0)
 *   pnpm release --version 2.5.3 # Set specific version
 *   pnpm release --current      # Show current version
 *   pnpm release --help         # Show help
 * 
 * Short aliases:
 *   pnpm release -p             # Same as --patch
 *   pnpm release -m             # Same as --minor
 *   pnpm release -M             # Same as --major
 */

import fs from 'fs/promises'
import { execSync } from 'child_process'

// ==================== ARGUMENT PARSER ====================

/**
 * Parse command line arguments into flags object
 */
function parseArguments(args) {
  const flags = {
    patch: false,
    minor: false,
    major: false,
    version: null,
    current: false,
    help: false
  }
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    if (arg === '--patch' || arg === '-p') flags.patch = true
    else if (arg === '--minor' || arg === '-m') flags.minor = true
    else if (arg === '--major' || arg === '-M') flags.major = true
    else if (arg === '--version' || arg === '-v') {
      flags.version = args[++i]
    }
    else if (arg.startsWith('--version=')) {
      flags.version = arg.split('=')[1]
    }
    else if (arg === '--current') flags.current = true
    else if (arg === '--help' || arg === '-h') flags.help = true
  }
  
  return flags
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Read current version from core.version.json
 */
async function getCurrentVersion() {
  try {
    const versionFile = await fs.readFile('core.version.json', 'utf8')
    const data = JSON.parse(versionFile)
    return data.version
  } catch (error) {
    console.error('❌ Error: Cannot read core.version.json')
    console.error('   Make sure you are running from the project root.')
    process.exit(1)
  }
}

/**
 * Parse version string into components
 */
function parseVersion(version) {
  // Remove 'v' prefix if exists
  const cleanVersion = version.replace(/^v/, '')
  const match = cleanVersion.match(/^(\d+)\.(\d+)\.(\d+)$/)
  
  if (!match) {
    throw new Error(`Invalid version format: ${version}. Expected format: X.Y.Z`)
  }
  
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10)
  }
}

/**
 * Increment version based on type
 */
function incrementVersion(currentVersion, type) {
  const { major, minor, patch } = parseVersion(currentVersion)
  
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    default:
      throw new Error(`Invalid increment type: ${type}`)
  }
}

/**
 * Validate version format
 */
function validateVersion(version) {
  const cleanVersion = version.replace(/^v/, '')
  const regex = /^\d+\.\d+\.\d+$/
  return regex.test(cleanVersion)
}

/**
 * Update core.version.json with new version
 */
async function updateVersionFile(newVersion) {
  try {
    const versionFile = await fs.readFile('core.version.json', 'utf8')
    const data = JSON.parse(versionFile)
    
    // Update version and timestamp
    data.version = newVersion
    data.updatedAt = new Date().toISOString()
    
    await fs.writeFile(
      'core.version.json',
      JSON.stringify(data, null, 2) + '\n'
    )
  } catch (error) {
    console.error('❌ Error updating core.version.json:', error.message)
    process.exit(1)
  }
}

/**
 * Check if git working directory is clean
 */
function checkGitStatus() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' })
    return status.trim().length === 0
  } catch {
    console.warn('⚠️  Warning: Not a git repository')
    return true // Allow release in non-git projects
  }
}

/**
 * Check if git is available
 */
function isGitAvailable() {
  try {
    execSync('git --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Create git commit and tag
 */
function createGitRelease(version) {
  if (!isGitAvailable()) {
    console.warn('⚠️  Git not available, skipping commit and tag creation')
    return false
  }

  try {
    // Stage core.version.json
    execSync('git add core.version.json', { stdio: 'inherit' })
    
    // Create commit
    execSync(`git commit -m "chore: release v${version}"`, { stdio: 'inherit' })
    
    // Create tag
    execSync(`git tag -a v${version} -m "Release v${version}"`, { stdio: 'inherit' })
    
    return true
  } catch (error) {
    console.error('❌ Error creating git release:', error.message)
    return false
  }
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
NextSpark Version Release v2.0

Usage:
  pnpm release [options]

Options:
  --patch, -p             Increment patch version (0.1.0 → 0.1.1)
  --minor, -m             Increment minor version (0.1.0 → 0.2.0)
  --major, -M             Increment major version (0.1.0 → 1.0.0)
  --version <version>     Set specific version (e.g., 2.5.3)
  --current               Show current version
  --help, -h              Show this help message

Version Types:
  PATCH: Bug fixes and minor changes (backward compatible)
         Example: 0.1.0 → 0.1.1
         
  MINOR: New features (backward compatible)
         Example: 0.1.0 → 0.2.0
         
  MAJOR: Breaking changes (requires migration)
         Example: 0.1.0 → 1.0.0

Examples:
  pnpm release --patch         # Bug fix release
  pnpm release -p              # Same as above (short)
  pnpm release --minor         # Feature release
  pnpm release -m              # Same as above (short)
  pnpm release --major         # Breaking change release
  pnpm release -M              # Same as above (short)
  pnpm release --version 2.5.3 # Set specific version
  pnpm release --current       # Show current version

What happens:
  1. Updates core.version.json with new version
  2. Creates git commit: "chore: release vX.Y.Z"
  3. Creates git tag: vX.Y.Z
  4. Shows instructions for pushing
  `)
  process.exit(0)
}

// ==================== MAIN FUNCTION ====================

async function releaseVersion() {
  const args = process.argv.slice(2)
  const flags = parseArguments(args)
  
  // Handle info commands
  if (flags.help) return showHelp()
  
  if (flags.current) {
    const version = await getCurrentVersion()
    console.log(`📦 Current version: v${version}`)
    process.exit(0)
  }
  
  console.log('🚀 NextSpark Version Release v2.0')
  console.log('━'.repeat(50))
  
  // Get current version
  const currentVersion = await getCurrentVersion()
  
  // Determine release type
  let newVersion
  let releaseType = 'custom'
  
  if (flags.patch) {
    newVersion = incrementVersion(currentVersion, 'patch')
    releaseType = 'patch'
  } else if (flags.minor) {
    newVersion = incrementVersion(currentVersion, 'minor')
    releaseType = 'minor'
  } else if (flags.major) {
    newVersion = incrementVersion(currentVersion, 'major')
    releaseType = 'major'
  } else if (flags.version) {
    if (!validateVersion(flags.version)) {
      console.error('❌ Error: Invalid version format')
      console.error('   Expected format: X.Y.Z (e.g., 2.5.3)')
      process.exit(1)
    }
    newVersion = flags.version.replace(/^v/, '')
    releaseType = 'custom'
  } else {
    console.error('❌ Error: No release type specified')
    console.error('')
    console.error('Usage:')
    console.error('  pnpm release --patch       # Increment patch (0.1.0 → 0.1.1)')
    console.error('  pnpm release --minor       # Increment minor (0.1.0 → 0.2.0)')
    console.error('  pnpm release --major       # Increment major (0.1.0 → 1.0.0)')
    console.error('  pnpm release --version 2.5.3  # Set specific version')
    console.error('  pnpm release --help        # Show help')
    process.exit(1)
  }
  
  if (releaseType !== 'custom') {
    console.log(`📊 Type: ${releaseType.toUpperCase()}`)
  } else {
    console.log(`📊 Type: Specific version`)
  }
  console.log(`📦 Current: v${currentVersion}`)
  console.log(`📦 New:     v${newVersion}`)
  
  // Explain what this release means
  if (releaseType === 'major') {
    console.log('   ⚠️  MAJOR: Breaking changes - requires migration')
  } else if (releaseType === 'minor') {
    console.log('   ✨ MINOR: New features - backward compatible')
  } else if (releaseType === 'patch') {
    console.log('   🐛 PATCH: Bug fixes - backward compatible')
  }
  console.log()
  
  // Check git status
  if (!checkGitStatus()) {
    console.error('❌ Error: Uncommitted changes detected')
    console.error('   Commit or stash your changes first.')
    console.error('   Run: git status')
    process.exit(1)
  }
  
  // Update version file
  console.log('✍️  Updating core.version.json...')
  await updateVersionFile(newVersion)
  console.log('✓ Version file updated\n')
  
  // Create git release
  const hasGit = isGitAvailable()
  
  if (hasGit) {
    console.log('🏷️  Creating git release...')
    if (createGitRelease(newVersion)) {
      console.log(`✓ Commit created: "chore: release v${newVersion}"`)
      console.log(`✓ Tag created: v${newVersion}\n`)
    } else {
      console.warn('⚠️  Git release creation failed, but version was updated\n')
    }
  }
  
  // Success message
  console.log('━'.repeat(50))
  console.log('🎉 Release created successfully!\n')
  
  if (hasGit) {
    console.log('📖 Next steps:')
    console.log(`   1. Review: git show v${newVersion}`)
    console.log('   2. Push: git push origin main')
    console.log(`   3. Push tag: git push origin v${newVersion}`)
    console.log('   4. Create GitHub Release (optional)\n')
    console.log('💡 To create GitHub Release:')
    console.log(`   gh release create v${newVersion} --generate-notes\n`)
    console.log('🔙 To undo:')
    console.log(`   git tag -d v${newVersion} && git reset --hard HEAD~1`)
  } else {
    console.log('📖 Version updated in core.version.json')
    console.log('   Commit and push the changes manually.')
  }
}

// ==================== CLI ENTRY POINT ====================

releaseVersion().catch(error => {
  console.error('\n❌ Release failed:', error.message)
  process.exit(1)
})
