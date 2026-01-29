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

// ============================================================================
// Constants
// ============================================================================

/** Directory names used in monorepo structure */
const DIRS = {
  WEB: 'web',
  MOBILE: 'mobile',
  ASSETS: 'assets',
} as const

/** File names used in monorepo structure */
const FILES = {
  PNPM_WORKSPACE: 'pnpm-workspace.yaml',
  NPMRC: '.npmrc',
  GITIGNORE: '.gitignore',
  TSCONFIG: 'tsconfig.json',
  PACKAGE_JSON: 'package.json',
  README: 'README.md',
  APP_CONFIG: 'app.config.ts',
} as const

/** Required files in mobile template for validation */
const REQUIRED_MOBILE_TEMPLATE_FILES = [
  'app',
  'src',
  'babel.config.js',
  'metro.config.js',
] as const

/** Files to copy from mobile template */
const MOBILE_TEMPLATE_FILES = [
  'app',
  'src',
  'assets',
  'babel.config.js',
  'metro.config.js',
  'tailwind.config.js',
  'tsconfig.json',
  'jest.config.js',
  'eas.json',
] as const

// ============================================================================
// Package Versions (centralized for easy updates)
// ============================================================================

/**
 * Centralized package versions for mobile dependencies.
 * Update these when releasing new versions of NextSpark packages.
 */
const VERSIONS = {
  // NextSpark packages - use 'latest' for consistency with web packages
  NEXTSPARK_MOBILE: 'latest',
  NEXTSPARK_UI: 'latest',

  // Core dependencies
  TANSTACK_QUERY: '^5.62.0',
  EXPO: '^54.0.0',
  REACT: '19.1.0',
  REACT_NATIVE: '0.81.5',
  TYPESCRIPT: '^5.3.0',

  // Expo modules (use ~ for patch compatibility)
  EXPO_CONSTANTS: '~18.0.13',
  EXPO_LINKING: '~8.0.11',
  EXPO_ROUTER: '~6.0.22',
  EXPO_SECURE_STORE: '~15.0.8',
  EXPO_STATUS_BAR: '~3.0.9',

  // React Native modules
  RN_GESTURE_HANDLER: '~2.28.0',
  RN_REANIMATED: '~4.1.1',
  RN_SAFE_AREA: '~5.6.0',
  RN_SCREENS: '~4.16.0',
  RN_SVG: '15.12.1',
  RN_WEB: '^0.21.0',

  // Styling
  NATIVEWIND: '^4.2.1',
  TAILWINDCSS: '^3',
  TAILWIND_MERGE: '^3.4.0',
  LUCIDE_RN: '^0.563.0',

  // Dev dependencies
  BABEL_CORE: '^7.25.0',
  JEST: '^29.7.0',
  JEST_EXPO: '^54.0.16',
  TESTING_LIBRARY_JEST_NATIVE: '^5.4.3',
  TESTING_LIBRARY_RN: '^13.3.3',
} as const

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the mobile templates directory path from @nextsparkjs/mobile.
 * Searches multiple possible paths for maximum compatibility.
 *
 * @throws {Error} If templates directory cannot be found with actionable guidance
 * @returns The absolute path to the mobile templates directory
 */
function getMobileTemplatesDir(): string {
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

  // Provide actionable error message
  const searchedPaths = possiblePaths.map(p => `  - ${p}`).join('\n')
  throw new Error(
    `Could not find @nextsparkjs/mobile templates directory.\n\n` +
    `Searched paths:\n${searchedPaths}\n\n` +
    `To fix this, ensure @nextsparkjs/mobile is installed:\n` +
    `  pnpm add @nextsparkjs/mobile\n\n` +
    `If you're developing locally, make sure the mobile package is built:\n` +
    `  cd packages/mobile && pnpm build`
  )
}

/**
 * Validate that the mobile template has all required files.
 * This prevents partial or corrupted template copies.
 *
 * @param templateDir - Path to the mobile templates directory
 * @throws {Error} If required files are missing
 */
async function validateMobileTemplate(templateDir: string): Promise<void> {
  const missing: string[] = []

  for (const file of REQUIRED_MOBILE_TEMPLATE_FILES) {
    const filePath = path.join(templateDir, file)
    if (!await fs.pathExists(filePath)) {
      missing.push(file)
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Mobile template is incomplete. Missing required files:\n` +
      missing.map(f => `  - ${f}`).join('\n') + '\n\n' +
      `Template location: ${templateDir}\n` +
      `Please ensure @nextsparkjs/mobile is properly installed and built.`
    )
  }
}

/**
 * Convert a project slug to a valid iOS/Android bundle identifier.
 * Transforms "my-awesome-app" to "my.awesome.app" for better readability.
 *
 * @param slug - The project slug (e.g., "my-awesome-app")
 * @returns A valid bundle identifier (e.g., "my.awesome.app")
 */
function slugToBundleId(slug: string): string {
  return slug
    .toLowerCase()
    // Replace hyphens, underscores, and other non-alphanumeric chars with dots
    .replace(/[^a-z0-9]+/g, '.')
    // Remove leading/trailing dots
    .replace(/^\.+|\.+$/g, '')
    // Replace multiple consecutive dots with single dot
    .replace(/\.{2,}/g, '.')
}

// ============================================================================
// File Generators
// ============================================================================

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
      'dev': `pnpm --filter ${DIRS.WEB} dev`,
      'build': `pnpm --filter ${DIRS.WEB} build`,
      'start': `pnpm --filter ${DIRS.WEB} start`,
      'lint': 'pnpm -r lint',
      // Mobile commands
      'dev:mobile': `pnpm --filter ${DIRS.MOBILE} start`,
      'ios': `pnpm --filter ${DIRS.MOBILE} ios`,
      'android': `pnpm --filter ${DIRS.MOBILE} android`,
      // Shared commands
      'typecheck': 'pnpm -r typecheck',
      'test': 'pnpm -r test',
      // Web-specific CLI commands (run from root)
      'db:migrate': `pnpm --filter ${DIRS.WEB} db:migrate`,
      'db:seed': `pnpm --filter ${DIRS.WEB} db:seed`,
      'build:registries': `pnpm --filter ${DIRS.WEB} build:registries`,
    },
    devDependencies: {
      'typescript': VERSIONS.TYPESCRIPT,
    }
  }

  await fs.writeJson(path.join(targetDir, FILES.PACKAGE_JSON), rootPkg, { spaces: 2 })
}

/**
 * Create the pnpm-workspace.yaml file
 */
async function createPnpmWorkspace(targetDir: string): Promise<void> {
  const workspaceContent = `packages:
  - '${DIRS.WEB}'
  - '${DIRS.MOBILE}'
`
  await fs.writeFile(path.join(targetDir, FILES.PNPM_WORKSPACE), workspaceContent)
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
  await fs.writeFile(path.join(targetDir, FILES.NPMRC), npmrcContent)
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
${DIRS.WEB}/contents/themes/*/tests/cypress/videos
${DIRS.WEB}/contents/themes/*/tests/cypress/screenshots
${DIRS.WEB}/contents/themes/*/tests/cypress/allure-results
${DIRS.WEB}/contents/themes/*/tests/cypress/allure-report

# Jest (theme-based in web/)
${DIRS.WEB}/contents/themes/*/tests/jest/coverage

# Mobile specific
${DIRS.MOBILE}/.expo/
*.jks
*.p8
*.p12
*.key
*.mobileprovision
*.orig.*
web-build/
`
  await fs.writeFile(path.join(targetDir, FILES.GITIGNORE), gitignoreContent)
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
      { path: `./${DIRS.WEB}` },
      { path: `./${DIRS.MOBILE}` }
    ]
  }

  await fs.writeJson(path.join(targetDir, FILES.TSCONFIG), tsConfig, { spaces: 2 })
}

/**
 * Copy mobile template files and customize them
 */
async function copyMobileTemplate(targetDir: string, config: WizardConfig): Promise<void> {
  const mobileTemplatesDir = getMobileTemplatesDir()

  // Validate template before copying
  await validateMobileTemplate(mobileTemplatesDir)

  const mobileDir = path.join(targetDir, DIRS.MOBILE)

  // Ensure mobile directory exists
  await fs.ensureDir(mobileDir)

  // Copy all template files
  for (const item of MOBILE_TEMPLATE_FILES) {
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
  await createMobileAssets(mobileDir, config)
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
      '@nextsparkjs/mobile': VERSIONS.NEXTSPARK_MOBILE,
      '@nextsparkjs/ui': VERSIONS.NEXTSPARK_UI,
      '@tanstack/react-query': VERSIONS.TANSTACK_QUERY,
      'expo': VERSIONS.EXPO,
      'expo-constants': VERSIONS.EXPO_CONSTANTS,
      'expo-linking': VERSIONS.EXPO_LINKING,
      'expo-router': VERSIONS.EXPO_ROUTER,
      'expo-secure-store': VERSIONS.EXPO_SECURE_STORE,
      'expo-status-bar': VERSIONS.EXPO_STATUS_BAR,
      'lucide-react-native': VERSIONS.LUCIDE_RN,
      'nativewind': VERSIONS.NATIVEWIND,
      'react': VERSIONS.REACT,
      'react-dom': VERSIONS.REACT,
      'react-native': VERSIONS.REACT_NATIVE,
      'react-native-web': VERSIONS.RN_WEB,
      'react-native-gesture-handler': VERSIONS.RN_GESTURE_HANDLER,
      'react-native-reanimated': VERSIONS.RN_REANIMATED,
      'react-native-safe-area-context': VERSIONS.RN_SAFE_AREA,
      'react-native-screens': VERSIONS.RN_SCREENS,
      'react-native-svg': VERSIONS.RN_SVG,
      'tailwind-merge': VERSIONS.TAILWIND_MERGE,
      'tailwindcss': VERSIONS.TAILWINDCSS
    },
    devDependencies: {
      '@babel/core': VERSIONS.BABEL_CORE,
      '@testing-library/jest-native': VERSIONS.TESTING_LIBRARY_JEST_NATIVE,
      '@testing-library/react-native': VERSIONS.TESTING_LIBRARY_RN,
      '@types/jest': '^29.5.0',
      '@types/react': '^19',
      'jest': VERSIONS.JEST,
      'jest-expo': VERSIONS.JEST_EXPO,
      'react-test-renderer': VERSIONS.REACT,
      'typescript': VERSIONS.TYPESCRIPT
    }
  }

  await fs.writeJson(path.join(mobileDir, FILES.PACKAGE_JSON), packageJson, { spaces: 2 })
}

/**
 * Create mobile app.config.ts with project-specific values
 */
async function createMobileAppConfig(mobileDir: string, config: WizardConfig): Promise<void> {
  // Convert project slug to bundle identifier format
  // "my-awesome-app" → "my.awesome.app"
  const bundleId = slugToBundleId(config.projectSlug)

  const appConfigContent = `import { ExpoConfig, ConfigContext } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: '${config.projectName}',
  slug: '${config.projectSlug}',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './${DIRS.ASSETS}/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './${DIRS.ASSETS}/splash.png',
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
      foregroundImage: './${DIRS.ASSETS}/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: 'com.${bundleId}.app',
  },
  web: {
    favicon: './${DIRS.ASSETS}/favicon.png',
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

  await fs.writeFile(path.join(mobileDir, FILES.APP_CONFIG), appConfigContent)
}

/**
 * Create mobile assets directory with placeholder files and documentation.
 * Includes detailed instructions for generating proper app icons.
 */
async function createMobileAssets(mobileDir: string, config: WizardConfig): Promise<void> {
  const assetsDir = path.join(mobileDir, DIRS.ASSETS)
  await fs.ensureDir(assetsDir)

  // Create .gitkeep to ensure directory is tracked
  await fs.writeFile(
    path.join(assetsDir, '.gitkeep'),
    '# Placeholder - replace with your app icons and splash screens\n'
  )

  // Create detailed README for assets
  const assetsReadme = `# Mobile App Assets for ${config.projectName}

This directory contains your mobile app icons and splash screens.

## Required Files

| File | Size | Description |
|------|------|-------------|
| \`icon.png\` | 1024x1024px | Main app icon (iOS & Android) |
| \`splash.png\` | 1284x2778px | Splash screen image |
| \`adaptive-icon.png\` | 1024x1024px | Android adaptive icon (foreground) |
| \`favicon.png\` | 48x48px | Web favicon |

## How to Generate

### Option 1: Expo Asset Generator (Recommended)

1. Create a 1024x1024px icon image
2. Use Expo's icon generator:
   \`\`\`bash
   npx expo-optimize
   \`\`\`

### Option 2: Online Tools

- [Expo Icon Generator](https://docs.expo.dev/develop/user-interface/app-icons/)
- [App Icon Generator](https://appicon.co/)
- [Figma App Icon Template](https://www.figma.com/community/file/824894885635013116)

### Option 3: Manual Creation

Create each file at the specified sizes above. Use PNG format with transparency for icons.

## Tips

- Use a simple, recognizable design that works at small sizes
- Test your icon on both light and dark backgrounds
- Avoid text in the icon (it becomes illegible at small sizes)
- Keep important content within the "safe zone" (center 80%)

## Resources

- [Expo App Icons Documentation](https://docs.expo.dev/develop/user-interface/app-icons/)
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [Android Adaptive Icons](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive)
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
├── ${DIRS.WEB}/                    # Next.js web application
│   ├── app/                # Next.js App Router
│   ├── contents/           # Themes and plugins
│   └── package.json
├── ${DIRS.MOBILE}/                 # Expo mobile application
│   ├── app/                # Expo Router screens
│   ├── src/                # Mobile-specific code
│   └── package.json
├── package.json            # Root monorepo
└── ${FILES.PNPM_WORKSPACE}
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
cp ${DIRS.WEB}/.env.example ${DIRS.WEB}/.env
# Edit ${DIRS.WEB}/.env with your configuration
\`\`\`

### Development

**Web Application:**
\`\`\`bash
# From root directory
pnpm dev

# Or from web directory
cd ${DIRS.WEB} && pnpm dev
\`\`\`

**Mobile Application:**
\`\`\`bash
# From root directory
pnpm dev:mobile

# Or from mobile directory
cd ${DIRS.MOBILE} && pnpm start
\`\`\`

### Running Tests

\`\`\`bash
# Run all tests
pnpm test

# Run web tests only
pnpm --filter ${DIRS.WEB} test

# Run mobile tests only
pnpm --filter ${DIRS.MOBILE} test
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
cd ${DIRS.MOBILE}
eas build --platform ios
eas build --platform android
\`\`\`

## Learn More

- [NextSpark Documentation](https://nextspark.dev/docs)
- [Expo Documentation](https://docs.expo.dev)
- [Next.js Documentation](https://nextjs.org/docs)
`

  await fs.writeFile(path.join(targetDir, FILES.README), readmeContent)
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate the monorepo project structure.
 *
 * This creates the root structure and mobile app, then delegates
 * to the web generator for the web/ directory.
 *
 * @param targetDir - The root directory where the project will be created
 * @param config - The wizard configuration with project settings
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
  const webDir = path.join(targetDir, DIRS.WEB)
  await fs.ensureDir(webDir)

  // 3. Copy mobile template
  await copyMobileTemplate(targetDir, config)
}

/**
 * Check if a project is using monorepo structure.
 *
 * @param config - The wizard configuration
 * @returns True if the project type is 'web-mobile' (monorepo)
 */
export function isMonorepoProject(config: WizardConfig): boolean {
  return config.projectType === 'web-mobile'
}

/**
 * Get the web directory path based on project type.
 *
 * For monorepo projects, returns the path to the web/ subdirectory.
 * For flat projects, returns the target directory itself.
 *
 * @param targetDir - The project root directory
 * @param config - The wizard configuration
 * @returns The absolute path to the web directory
 */
export function getWebDir(targetDir: string, config: WizardConfig): string {
  return config.projectType === 'web-mobile'
    ? path.join(targetDir, DIRS.WEB)
    : targetDir
}
