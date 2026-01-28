/**
 * Monorepo Generator
 *
 * Generates a monorepo structure with web/ and mobile/ directories
 * for projects that need both Next.js web and Expo mobile apps.
 */

import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import type { WizardConfig } from '../types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Get the mobile templates directory path from @nextsparkjs/mobile
 */
function getMobileTemplatesDir(): string {
  // Check multiple possible paths for mobile templates directory
  // Priority: installed package in node_modules > development monorepo paths
  const possiblePaths = [
    // From CWD node_modules (installed package)
    path.resolve(process.cwd(), 'node_modules/@nextsparkjs/mobile/templates'),
    // From CLI dist folder: ../../mobile/templates (development)
    path.resolve(__dirname, '../../mobile/templates'),
    // Legacy paths for different build structures
    path.resolve(__dirname, '../../../../../mobile/templates'),
    path.resolve(__dirname, '../../../../mobile/templates'),
  ]

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p
    }
  }

  throw new Error(`Could not find @nextsparkjs/mobile templates directory. Searched: ${possiblePaths.join(', ')}`)
}

/**
 * Create the root monorepo package.json
 */
async function createRootPackageJson(targetDir: string, config: WizardConfig): Promise<void> {
  const rootPkg = {
    name: config.projectSlug,
    version: '0.1.0',
    private: true,
    scripts: {
      // Web commands
      'dev': 'pnpm --filter web dev',
      'build': 'pnpm --filter web build',
      'start': 'pnpm --filter web start',
      'lint': 'pnpm -r lint',
      // Mobile commands
      'dev:mobile': 'pnpm --filter mobile start',
      'ios': 'pnpm --filter mobile ios',
      'android': 'pnpm --filter mobile android',
      // Shared commands
      'typecheck': 'pnpm -r typecheck',
      'test': 'pnpm -r test',
      // Web-specific CLI commands (run from root)
      'db:migrate': 'pnpm --filter web db:migrate',
      'db:seed': 'pnpm --filter web db:seed',
      'build:registries': 'pnpm --filter web build:registries',
    },
    devDependencies: {
      'typescript': '^5.7.3',
    }
  }

  await fs.writeJson(path.join(targetDir, 'package.json'), rootPkg, { spaces: 2 })
}

/**
 * Create the pnpm-workspace.yaml file
 */
async function createPnpmWorkspace(targetDir: string): Promise<void> {
  const workspaceContent = `packages:
  - 'web'
  - 'mobile'
`
  await fs.writeFile(path.join(targetDir, 'pnpm-workspace.yaml'), workspaceContent)
}

/**
 * Create the root .npmrc file for proper hoisting
 */
async function createNpmrc(targetDir: string): Promise<void> {
  const npmrcContent = `# Enable proper hoisting for monorepo
public-hoist-pattern[]=*@nextsparkjs/*
public-hoist-pattern[]=*expo*
public-hoist-pattern[]=*react-native*
shamefully-hoist=true
`
  await fs.writeFile(path.join(targetDir, '.npmrc'), npmrcContent)
}

/**
 * Create the root .gitignore file
 */
async function createGitignore(targetDir: string): Promise<void> {
  const gitignoreContent = `# Dependencies
node_modules/

# Build outputs
.next/
dist/
out/
build/
.expo/

# NextSpark
.nextspark/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
coverage/
.nyc_output/

# Cypress (theme-based in web/)
web/contents/themes/*/tests/cypress/videos
web/contents/themes/*/tests/cypress/screenshots
web/contents/themes/*/tests/cypress/allure-results
web/contents/themes/*/tests/cypress/allure-report

# Jest (theme-based in web/)
web/contents/themes/*/tests/jest/coverage

# Mobile specific
mobile/.expo/
*.jks
*.p8
*.p12
*.key
*.mobileprovision
*.orig.*
web-build/
`
  await fs.writeFile(path.join(targetDir, '.gitignore'), gitignoreContent)
}

/**
 * Create root tsconfig.json for monorepo
 */
async function createRootTsConfig(targetDir: string): Promise<void> {
  const tsConfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      skipLibCheck: true,
      esModuleInterop: true,
    },
    references: [
      { path: './web' },
      { path: './mobile' }
    ]
  }

  await fs.writeJson(path.join(targetDir, 'tsconfig.json'), tsConfig, { spaces: 2 })
}

/**
 * Copy mobile template files and customize them
 */
async function copyMobileTemplate(targetDir: string, config: WizardConfig): Promise<void> {
  const mobileTemplatesDir = getMobileTemplatesDir()
  const mobileDir = path.join(targetDir, 'mobile')

  // Ensure mobile directory exists
  await fs.ensureDir(mobileDir)

  // Copy all template files
  const itemsToCopy = [
    'app',
    'src',
    'babel.config.js',
    'metro.config.js',
    'tailwind.config.js',
    'tsconfig.json',
    'jest.config.js',
    'eas.json',
  ]

  for (const item of itemsToCopy) {
    const srcPath = path.join(mobileTemplatesDir, item)
    const destPath = path.join(mobileDir, item)

    if (await fs.pathExists(srcPath)) {
      await fs.copy(srcPath, destPath)
    }
  }

  // Create customized package.json
  await createMobilePackageJson(mobileDir, config)

  // Create customized app.config.ts
  await createMobileAppConfig(mobileDir, config)

  // Create assets directory with placeholders
  await createMobileAssets(mobileDir)
}

/**
 * Create mobile package.json with project-specific values
 */
async function createMobilePackageJson(mobileDir: string, config: WizardConfig): Promise<void> {
  const mobileSlug = `${config.projectSlug}-mobile`

  const packageJson = {
    name: mobileSlug,
    version: '0.1.0',
    private: true,
    main: 'expo-router/entry',
    scripts: {
      start: 'expo start',
      android: 'expo start --android',
      ios: 'expo start --ios',
      web: 'expo start --web',
      lint: 'eslint .',
      typecheck: 'tsc --noEmit',
      test: 'jest',
      'test:watch': 'jest --watch',
      'test:coverage': 'jest --coverage'
    },
    dependencies: {
      '@nextsparkjs/mobile': '^0.1.0-beta.1',
      '@nextsparkjs/ui': '^0.1.0-beta.1',
      '@tanstack/react-query': '^5.62.0',
      'expo': '^54.0.0',
      'expo-constants': '~18.0.13',
      'expo-linking': '~8.0.11',
      'expo-router': '~6.0.22',
      'expo-secure-store': '~15.0.8',
      'expo-status-bar': '~3.0.9',
      'lucide-react-native': '^0.563.0',
      'nativewind': '^4.2.1',
      'react': '19.1.0',
      'react-dom': '19.1.0',
      'react-native': '0.81.5',
      'react-native-web': '^0.21.0',
      'react-native-gesture-handler': '~2.28.0',
      'react-native-reanimated': '~4.1.1',
      'react-native-safe-area-context': '~5.6.0',
      'react-native-screens': '~4.16.0',
      'react-native-svg': '15.12.1',
      'tailwind-merge': '^3.4.0',
      'tailwindcss': '^3'
    },
    devDependencies: {
      '@babel/core': '^7.25.0',
      '@testing-library/jest-native': '^5.4.3',
      '@testing-library/react-native': '^13.3.3',
      '@types/jest': '^29.5.0',
      '@types/react': '^19',
      'jest': '^29.7.0',
      'jest-expo': '^54.0.16',
      'react-test-renderer': '19.1.0',
      'typescript': '^5.3.0'
    }
  }

  await fs.writeJson(path.join(mobileDir, 'package.json'), packageJson, { spaces: 2 })
}

/**
 * Create mobile app.config.ts with project-specific values
 */
async function createMobileAppConfig(mobileDir: string, config: WizardConfig): Promise<void> {
  // Convert project slug to bundle identifier format (lowercase, no special chars)
  const bundleId = config.projectSlug.toLowerCase().replace(/[^a-z0-9]/g, '')

  const appConfigContent = `import { ExpoConfig, ConfigContext } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: '${config.projectName}',
  slug: '${config.projectSlug}',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.${bundleId}.app',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: 'com.${bundleId}.app',
  },
  web: {
    favicon: './assets/favicon.png',
  },
  extra: {
    // API URL - Configure for your environment
    // Development: point to your local web app (e.g., http://localhost:3000)
    // Production: set via EAS environment variables
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
  },
  plugins: ['expo-router', 'expo-secure-store'],
  scheme: '${config.projectSlug}',
})
`

  await fs.writeFile(path.join(mobileDir, 'app.config.ts'), appConfigContent)
}

/**
 * Create placeholder mobile assets
 */
async function createMobileAssets(mobileDir: string): Promise<void> {
  const assetsDir = path.join(mobileDir, 'assets')
  await fs.ensureDir(assetsDir)

  // Create a simple .gitkeep to ensure the directory is tracked
  await fs.writeFile(path.join(assetsDir, '.gitkeep'), '# Add your app icons and splash screens here\n')

  // Create README for assets
  const assetsReadme = `# Mobile App Assets

Add your app icons and splash screens here:

- \`icon.png\` - App icon (1024x1024px recommended)
- \`splash.png\` - Splash screen image
- \`adaptive-icon.png\` - Android adaptive icon foreground
- \`favicon.png\` - Web favicon

You can use Expo's asset generator to create these:
https://docs.expo.dev/develop/user-interface/app-icons/
`
  await fs.writeFile(path.join(assetsDir, 'README.md'), assetsReadme)
}

/**
 * Create monorepo README.md
 */
async function createMonorepoReadme(targetDir: string, config: WizardConfig): Promise<void> {
  const readmeContent = `# ${config.projectName}

${config.projectDescription}

## Project Structure

This is a monorepo containing both web and mobile applications:

\`\`\`
${config.projectSlug}/
├── web/                    # Next.js web application
│   ├── app/                # Next.js App Router
│   ├── contents/           # Themes and plugins
│   └── package.json
├── mobile/                 # Expo mobile application
│   ├── app/                # Expo Router screens
│   ├── src/                # Mobile-specific code
│   └── package.json
├── package.json            # Root monorepo
└── pnpm-workspace.yaml
\`\`\`

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- For mobile: Expo CLI (\`npm install -g expo-cli\`)

### Installation

\`\`\`bash
# Install all dependencies
pnpm install

# Set up environment variables
cp web/.env.example web/.env
# Edit web/.env with your configuration
\`\`\`

### Development

**Web Application:**
\`\`\`bash
# From root directory
pnpm dev

# Or from web directory
cd web && pnpm dev
\`\`\`

**Mobile Application:**
\`\`\`bash
# From root directory
pnpm dev:mobile

# Or from mobile directory
cd mobile && pnpm start
\`\`\`

### Running Tests

\`\`\`bash
# Run all tests
pnpm test

# Run web tests only
pnpm --filter web test

# Run mobile tests only
pnpm --filter mobile test
\`\`\`

## Mobile App Configuration

The mobile app connects to your web API. Configure the API URL:

- **Development:** The mobile app will auto-detect your local server
- **Production:** Set \`EXPO_PUBLIC_API_URL\` in your EAS environment

## Building for Production

**Web:**
\`\`\`bash
pnpm build
\`\`\`

**Mobile:**
\`\`\`bash
cd mobile
eas build --platform ios
eas build --platform android
\`\`\`

## Learn More

- [NextSpark Documentation](https://nextspark.dev/docs)
- [Expo Documentation](https://docs.expo.dev)
- [Next.js Documentation](https://nextjs.org/docs)
`

  await fs.writeFile(path.join(targetDir, 'README.md'), readmeContent)
}

/**
 * Generate the monorepo project structure
 * This creates the root structure and mobile app, then delegates
 * to the web generator for the web/ directory
 */
export async function generateMonorepoStructure(targetDir: string, config: WizardConfig): Promise<void> {
  // 1. Create root monorepo files
  await createRootPackageJson(targetDir, config)
  await createPnpmWorkspace(targetDir)
  await createNpmrc(targetDir)
  await createGitignore(targetDir)
  await createRootTsConfig(targetDir)
  await createMonorepoReadme(targetDir, config)

  // 2. Create web/ directory
  const webDir = path.join(targetDir, 'web')
  await fs.ensureDir(webDir)

  // 3. Copy mobile template
  await copyMobileTemplate(targetDir, config)
}

/**
 * Check if a project is using monorepo structure
 */
export function isMonorepoProject(config: WizardConfig): boolean {
  return config.projectType === 'web-mobile'
}

/**
 * Get the web directory path (for monorepo or flat structure)
 */
export function getWebDir(targetDir: string, config: WizardConfig): string {
  return config.projectType === 'web-mobile'
    ? path.join(targetDir, 'web')
    : targetDir
}
