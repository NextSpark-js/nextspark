import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync, readdirSync, rmSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Path to templates folder (in the installed package)
// From bin/dist/init.js, go up 2 levels to reach packages/core/templates
const TEMPLATES_DIR = resolve(__dirname, '../../templates')


// Console colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function copyDirectory(src: string, dest: string, description: string, force = false) {
  if (!existsSync(src)) {
    log(`   ⚠️  ${description} not found in package`, 'yellow')
    return false
  }

  if (existsSync(dest)) {
    if (force) {
      // Remove existing and replace with NextSpark version
      rmSync(dest, { recursive: true, force: true })
      log(`   🔄 Replacing ${description} with NextSpark version`, 'yellow')
    } else {
      log(`   ⏭️  ${description} already exists, skipping`, 'yellow')
      return false
    }
  }

  cpSync(src, dest, { recursive: true })
  log(`   ✅ Copied ${description}`, 'green')
  return true
}

function copyFile(src: string, dest: string, description: string, force = false) {
  if (!existsSync(src)) {
    log(`   ⚠️  ${description} not found in package`, 'yellow')
    return false
  }

  if (existsSync(dest)) {
    if (force) {
      log(`   🔄 Replacing ${description}`, 'yellow')
    } else {
      log(`   ⏭️  ${description} already exists, skipping`, 'yellow')
      return false
    }
  }

  const destDir = dirname(dest)
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true })
  }

  cpSync(src, dest)
  log(`   ✅ Copied ${description}`, 'green')
  return true
}

async function init() {
  log('\n🚀 Initializing NextSpark project...\n', 'blue')

  // Verify we're in a Node.js project
  if (!existsSync('package.json')) {
    log('❌ No package.json found. Please run this command in a Node.js project.', 'red')
    process.exit(1)
  }

  // Read package.json
  const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'))
  const hasCore = packageJson.dependencies?.['@nextsparkjs/core'] ||
                  packageJson.devDependencies?.['@nextsparkjs/core']

  if (!hasCore) {
    log('⚠️  Warning: @nextsparkjs/core not found in dependencies.', 'yellow')
    log('   Run: npm install @nextsparkjs/core\n', 'yellow')
  }

  // Check if templates exist
  if (!existsSync(TEMPLATES_DIR)) {
    log('❌ Templates directory not found in the package.', 'red')
    log('   This might be a packaging issue. Please reinstall @nextsparkjs/core.', 'red')
    process.exit(1)
  }

  // ========================================
  // 1. Copy main project structure
  // ========================================
  log('📁 Setting up project structure...', 'blue')

  // Copy app/ - FORCE overwrite because create-next-app creates a default app/
  copyDirectory(
    join(TEMPLATES_DIR, 'app'),
    resolve(process.cwd(), 'app'),
    'app/',
    true // Force overwrite
  )

  // Copy contents/
  copyDirectory(
    join(TEMPLATES_DIR, 'contents'),
    resolve(process.cwd(), 'contents'),
    'contents/'
  )

  // Copy public/ - FORCE overwrite because create-next-app creates a default public/
  copyDirectory(
    join(TEMPLATES_DIR, 'public'),
    resolve(process.cwd(), 'public'),
    'public/',
    true // Force overwrite
  )

  // ========================================
  // 2. Copy config files
  // ========================================
  log('\n📄 Setting up configuration files...', 'blue')

  // Copy next.config.mjs - FORCE because create-next-app creates one
  copyFile(
    join(TEMPLATES_DIR, 'next.config.mjs'),
    resolve(process.cwd(), 'next.config.mjs'),
    'next.config.mjs',
    true // Force overwrite
  )

  // Copy tsconfig.json - FORCE because create-next-app creates one
  copyFile(
    join(TEMPLATES_DIR, 'tsconfig.json'),
    resolve(process.cwd(), 'tsconfig.json'),
    'tsconfig.json',
    true // Force overwrite
  )

  // Copy postcss.config.mjs - FORCE because create-next-app creates one
  copyFile(
    join(TEMPLATES_DIR, 'postcss.config.mjs'),
    resolve(process.cwd(), 'postcss.config.mjs'),
    'postcss.config.mjs',
    true // Force overwrite
  )

  // Copy i18n.ts - Required for next-intl
  copyFile(
    join(TEMPLATES_DIR, 'i18n.ts'),
    resolve(process.cwd(), 'i18n.ts'),
    'i18n.ts',
    true // Force overwrite
  )

  // Copy npmrc as .npmrc - Required for pnpm hoisting of dependencies
  // Note: Source is "npmrc" (without dot) because npm pack ignores dotfiles
  copyFile(
    join(TEMPLATES_DIR, 'npmrc'),
    resolve(process.cwd(), '.npmrc'),
    '.npmrc'
  )

  // Copy tsconfig.cypress.json - Required for Cypress TypeScript support
  copyFile(
    join(TEMPLATES_DIR, 'tsconfig.cypress.json'),
    resolve(process.cwd(), 'tsconfig.cypress.json'),
    'tsconfig.cypress.json'
  )

  // Copy cypress.d.ts - Type extensions for Cypress (@cypress/grep tags)
  copyFile(
    join(TEMPLATES_DIR, 'cypress.d.ts'),
    resolve(process.cwd(), 'cypress.d.ts'),
    'cypress.d.ts'
  )

  // ========================================
  // 3. Update package.json scripts
  // ========================================
  log('\n📦 Updating package.json...', 'blue')

  const updatedPackageJson = { ...packageJson }
  updatedPackageJson.scripts = updatedPackageJson.scripts || {}

  const scriptsToAdd: Record<string, string> = {
    'dev': 'next dev --turbopack',
    'build': 'next build',
    'start': 'next start',
    'lint': 'next lint',
    'build:registries': 'node node_modules/@nextsparkjs/core/scripts/build/registry.mjs',
    'db:migrate': 'node node_modules/@nextsparkjs/core/scripts/db/run-migrations.mjs',
    'test:theme': 'jest --config contents/themes/default/tests/jest/jest.config.ts',
    'cy:open': 'cypress open --config-file contents/themes/default/tests/cypress.config.ts',
    'cy:run': 'cypress run --config-file contents/themes/default/tests/cypress.config.ts',
    // Allure commands (results auto-generated when allure-cypress is installed)
    'allure:generate': 'allure generate contents/themes/default/tests/cypress/allure-results --clean -o contents/themes/default/tests/cypress/allure-report',
    'allure:open': 'allure open contents/themes/default/tests/cypress/allure-report',
  }

  let scriptsAdded = 0
  for (const [name, command] of Object.entries(scriptsToAdd)) {
    if (!updatedPackageJson.scripts[name]) {
      updatedPackageJson.scripts[name] = command
      scriptsAdded++
    }
  }

  if (scriptsAdded > 0) {
    writeFileSync('package.json', JSON.stringify(updatedPackageJson, null, 2) + '\n')
    log(`   ✅ Added ${scriptsAdded} scripts to package.json`, 'green')
  } else {
    log('   ⏭️  All scripts already exist', 'yellow')
  }

  // ========================================
  // 3b. Inject plugin dependencies
  // ========================================
  log('\n🔌 Scanning plugin dependencies...', 'blue')

  const pluginsDir = resolve(process.cwd(), 'contents', 'plugins')
  let pluginDepsAdded = 0

  if (existsSync(pluginsDir)) {
    const pluginFolders = readdirSync(pluginsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)

    // Re-read package.json to get latest state
    const currentPackageJson = JSON.parse(readFileSync('package.json', 'utf-8'))
    currentPackageJson.dependencies = currentPackageJson.dependencies || {}

    for (const pluginName of pluginFolders) {
      const pluginPackageJsonPath = join(pluginsDir, pluginName, 'package.json')

      if (existsSync(pluginPackageJsonPath)) {
        try {
          const pluginPackageJson = JSON.parse(readFileSync(pluginPackageJsonPath, 'utf-8'))
          const pluginDeps = pluginPackageJson.dependencies || {}

          for (const [depName, depVersion] of Object.entries(pluginDeps)) {
            if (!currentPackageJson.dependencies[depName]) {
              currentPackageJson.dependencies[depName] = depVersion
              pluginDepsAdded++
              log(`   ➕ ${depName}@${depVersion} (from ${pluginName})`, 'cyan')
            }
          }
        } catch (error) {
          log(`   ⚠️  Could not parse ${pluginName}/package.json`, 'yellow')
        }
      }
    }

    if (pluginDepsAdded > 0) {
      writeFileSync('package.json', JSON.stringify(currentPackageJson, null, 2) + '\n')
      log(`   ✅ Added ${pluginDepsAdded} plugin dependencies`, 'green')
    } else {
      log('   ⏭️  No new plugin dependencies to add', 'yellow')
    }
  }

  // ========================================
  // 3c. Inject core dependencies
  // ========================================
  log('\n📦 Adding core dependencies...', 'blue')

  const coreDevDependencies: Record<string, string> = {
    // Tailwind CSS v4 PostCSS plugin (required by postcss.config.mjs)
    '@tailwindcss/postcss': '^4',
  }

  // Re-read package.json to get latest state
  const pkgJsonForCore = JSON.parse(readFileSync('package.json', 'utf-8'))
  pkgJsonForCore.devDependencies = pkgJsonForCore.devDependencies || {}

  let coreDepsAdded = 0
  for (const [depName, depVersion] of Object.entries(coreDevDependencies)) {
    if (!pkgJsonForCore.devDependencies[depName]) {
      pkgJsonForCore.devDependencies[depName] = depVersion
      coreDepsAdded++
      log(`   ➕ ${depName}@${depVersion}`, 'cyan')
    }
  }

  if (coreDepsAdded > 0) {
    writeFileSync('package.json', JSON.stringify(pkgJsonForCore, null, 2) + '\n')
    log(`   ✅ Added ${coreDepsAdded} core dependencies`, 'green')
  } else {
    log('   ⏭️  All core dependencies already exist', 'yellow')
  }

  // ========================================
  // 3d. Inject test dependencies
  // ========================================
  log('\n🧪 Adding test dependencies...', 'blue')

  const testDevDependencies: Record<string, string> = {
    // Jest dependencies
    'jest': '^29.7.0',
    'ts-jest': '^29.2.5',
    'ts-node': '^10.9.2',
    '@types/jest': '^29.5.14',
    '@testing-library/jest-dom': '^6.6.3',
    '@testing-library/react': '^16.3.0',
    'jest-environment-jsdom': '^29.7.0',
    // Cypress dependencies
    'cypress': '^15.0.0',
    '@testing-library/cypress': '^10.0.2',
    '@cypress/webpack-preprocessor': '^6.0.2',
    '@cypress/grep': '^4.1.0',
    'ts-loader': '^9.5.1',
    'webpack': '^5.97.0',
    // Allure reporting (for Cypress)
    'allure-cypress': '^3.0.0',
    'allure-commandline': '^2.27.0',
  }

  // Re-read package.json to get latest state
  const pkgJsonForTests = JSON.parse(readFileSync('package.json', 'utf-8'))
  pkgJsonForTests.devDependencies = pkgJsonForTests.devDependencies || {}

  let testDepsAdded = 0
  for (const [depName, depVersion] of Object.entries(testDevDependencies)) {
    if (!pkgJsonForTests.devDependencies[depName]) {
      pkgJsonForTests.devDependencies[depName] = depVersion
      testDepsAdded++
      log(`   ➕ ${depName}@${depVersion}`, 'cyan')
    }
  }

  if (testDepsAdded > 0) {
    writeFileSync('package.json', JSON.stringify(pkgJsonForTests, null, 2) + '\n')
    log(`   ✅ Added ${testDepsAdded} test dependencies`, 'green')
  } else {
    log('   ⏭️  All test dependencies already exist', 'yellow')
  }

  // ========================================
  // 4. Update .gitignore
  // ========================================
  const gitignorePath = resolve(process.cwd(), '.gitignore')
  const gitignoreEntries = `
# NextSpark
.nextspark/

# Cypress (theme-based)
contents/themes/*/tests/cypress/videos
contents/themes/*/tests/cypress/screenshots
contents/themes/*/tests/cypress/allure-results
contents/themes/*/tests/cypress/allure-report

# Jest (theme-based)
contents/themes/*/tests/jest/coverage

# Environment
.env
.env.local
`

  if (existsSync(gitignorePath)) {
    const currentGitignore = readFileSync(gitignorePath, 'utf-8')
    if (!currentGitignore.includes('.nextspark/')) {
      writeFileSync(gitignorePath, currentGitignore + gitignoreEntries)
      log('\n📝 Updated .gitignore', 'green')
    }
  }

  // ========================================
  // Success message and next steps
  // ========================================
  log('\n' + '═'.repeat(50), 'cyan')
  log('✨ NextSpark initialized successfully!', 'green')
  log('═'.repeat(50) + '\n', 'cyan')

  log('📋 Next steps:\n', 'blue')

  log('  1. Reinstall dependencies (applies hoisting + installs test deps):', 'reset')
  log('     rm -rf node_modules && pnpm install', 'cyan')
  log('')

  log('  2. Create your .env file:', 'reset')
  log('     Copy from your reference or create with required variables:', 'reset')
  log('     - DATABASE_URL', 'yellow')
  log('     - BETTER_AUTH_SECRET', 'yellow')
  log('     - NEXT_PUBLIC_ACTIVE_THEME=default', 'yellow')
  log('')

  log('  3. Generate registries:', 'reset')
  log('     pnpm build:registries', 'cyan')
  log('')

  log('  4. Run database migrations:', 'reset')
  log('     pnpm db:migrate', 'cyan')
  log('')

  log('  5. Start development server:', 'reset')
  log('     pnpm dev', 'cyan')
  log('')

  log('  6. (Optional) Run theme tests:', 'reset')
  log('     pnpm test:theme           # Jest unit tests', 'cyan')
  log('     pnpm cy:open              # Cypress E2E tests', 'cyan')
  log('')
}

// Execute
init().catch((error) => {
  log(`\n❌ Error: ${error.message}`, 'red')
  process.exit(1)
})
