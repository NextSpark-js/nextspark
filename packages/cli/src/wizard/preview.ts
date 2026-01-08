/**
 * NextSpark Interactive Theme Preview
 *
 * Provides visual preview of files that will be generated based on wizard configuration.
 */

import chalk from 'chalk'
import type { WizardConfig } from './types.js'

/**
 * Box drawing characters for tree visualization
 */
const BOX = {
  vertical: '\u2502',      // |
  horizontal: '\u2500',    // -
  corner: '\u2514',        // L
  tee: '\u251C',           // |-
  topLeft: '\u250C',       // top-left corner
  topRight: '\u2510',      // top-right corner
  bottomLeft: '\u2514',    // bottom-left corner
  bottomRight: '\u2518',   // bottom-right corner
} as const

/**
 * Get the list of files that will be created based on configuration
 */
export function getFileTree(config: WizardConfig): string[] {
  const files: string[] = []
  const themeDir = `contents/themes/${config.projectSlug}`

  // Config files
  files.push(`${themeDir}/config/app.config.ts`)
  files.push(`${themeDir}/config/billing.config.ts`)
  files.push(`${themeDir}/config/dashboard.config.ts`)
  files.push(`${themeDir}/config/dev.config.ts`)
  files.push(`${themeDir}/config/permissions.config.ts`)
  files.push(`${themeDir}/config/theme.config.ts`)
  files.push(`${themeDir}/config/auth.config.ts`)
  files.push(`${themeDir}/config/dashboard-ui.config.ts`)
  files.push(`${themeDir}/config/dev-tools.config.ts`)

  // Entity files (tasks example entity)
  files.push(`${themeDir}/entities/tasks/entity.ts`)
  files.push(`${themeDir}/entities/tasks/schema.ts`)
  files.push(`${themeDir}/entities/tasks/permissions.ts`)

  // Block files (hero example block)
  files.push(`${themeDir}/blocks/hero/block.tsx`)
  files.push(`${themeDir}/blocks/hero/schema.ts`)
  files.push(`${themeDir}/blocks/hero/styles.ts`)

  // Messages files - only for supported locales
  for (const locale of config.supportedLocales) {
    files.push(`${themeDir}/messages/${locale}/common.json`)
    files.push(`${themeDir}/messages/${locale}/auth.json`)
    files.push(`${themeDir}/messages/${locale}/dashboard.json`)
    files.push(`${themeDir}/messages/${locale}/errors.json`)
  }

  // Migration files
  files.push(`${themeDir}/migrations/0001_initial_schema.sql`)
  files.push(`${themeDir}/migrations/0002_auth_tables.sql`)
  files.push(`${themeDir}/migrations/0003_tasks_entity.sql`)

  // Style files
  files.push(`${themeDir}/styles/globals.css`)
  files.push(`${themeDir}/styles/theme.css`)
  files.push(`${themeDir}/styles/components.css`)

  // Test files
  files.push(`${themeDir}/tests/cypress.config.ts`)
  files.push(`${themeDir}/tests/jest/jest.config.cjs`)
  files.push(`${themeDir}/tests/cypress/e2e/auth.cy.ts`)
  files.push(`${themeDir}/tests/cypress/e2e/dashboard.cy.ts`)
  files.push(`${themeDir}/tests/jest/components/hero.test.tsx`)

  return files
}

/**
 * Group files by category for display
 */
function groupFilesByCategory(files: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {
    config: [],
    entities: [],
    blocks: [],
    messages: [],
    migrations: [],
    styles: [],
    tests: [],
  }

  for (const file of files) {
    if (file.includes('/config/')) {
      groups.config.push(file)
    } else if (file.includes('/entities/')) {
      groups.entities.push(file)
    } else if (file.includes('/blocks/')) {
      groups.blocks.push(file)
    } else if (file.includes('/messages/')) {
      groups.messages.push(file)
    } else if (file.includes('/migrations/')) {
      groups.migrations.push(file)
    } else if (file.includes('/styles/')) {
      groups.styles.push(file)
    } else if (file.includes('/tests/')) {
      groups.tests.push(file)
    }
  }

  return groups
}

/**
 * Format file path for display (extract relative part after theme dir)
 */
function formatFilePath(file: string, themeDir: string): string {
  return file.replace(`${themeDir}/`, '')
}

/**
 * Display configuration preview with visual tree
 */
export function showConfigPreview(config: WizardConfig): void {
  const files = getFileTree(config)
  const groups = groupFilesByCategory(files)
  const themeDir = `contents/themes/${config.projectSlug}`

  console.log('')
  console.log(chalk.cyan.bold('  Theme Preview'))
  console.log(chalk.gray('  ' + '='.repeat(50)))
  console.log('')

  // Display theme directory header
  console.log(chalk.white.bold(`  ${BOX.topLeft}${'─'.repeat(48)}${BOX.topRight}`))
  console.log(chalk.white.bold(`  ${BOX.vertical}`) + chalk.cyan(` ${themeDir}/`) + ' '.repeat(48 - themeDir.length - 2) + chalk.white.bold(BOX.vertical))
  console.log(chalk.white.bold(`  ${BOX.vertical}${'─'.repeat(48)}${BOX.vertical}`))

  // Display each category
  const categoryLabels: Record<string, string> = {
    config: 'Configuration',
    entities: 'Entities',
    blocks: 'Blocks',
    messages: 'Messages (i18n)',
    migrations: 'Migrations',
    styles: 'Styles',
    tests: 'Tests',
  }

  const categoryIcons: Record<string, string> = {
    config: '*',
    entities: '@',
    blocks: '#',
    messages: '%',
    migrations: '~',
    styles: '&',
    tests: '!',
  }

  const categoryOrder = ['config', 'entities', 'blocks', 'messages', 'migrations', 'styles', 'tests']

  for (const category of categoryOrder) {
    const categoryFiles = groups[category]
    if (categoryFiles.length === 0) continue

    const label = categoryLabels[category]
    const icon = categoryIcons[category]

    console.log(chalk.white.bold(`  ${BOX.vertical}  `) + chalk.yellow(`[${icon}] ${label}`) + chalk.gray(` (${categoryFiles.length} files)`))

    for (let i = 0; i < categoryFiles.length; i++) {
      const file = categoryFiles[i]
      const isLast = i === categoryFiles.length - 1
      const prefix = isLast ? BOX.corner : BOX.tee
      const formattedPath = formatFilePath(file, themeDir)

      console.log(chalk.white.bold(`  ${BOX.vertical}  `) + chalk.gray(`    ${prefix}${BOX.horizontal} `) + chalk.white(formattedPath))
    }

    console.log(chalk.white.bold(`  ${BOX.vertical}`))
  }

  console.log(chalk.white.bold(`  ${BOX.bottomLeft}${'─'.repeat(48)}${BOX.bottomRight}`))
  console.log('')

  // Display summary
  console.log(chalk.cyan.bold('  Summary'))
  console.log(chalk.gray('  ' + '-'.repeat(30)))
  console.log('')

  const totalFiles = files.length
  const estimatedSize = '~350KB'

  console.log(chalk.white(`    Total files:      `) + chalk.green.bold(totalFiles.toString()))
  console.log(chalk.white(`    Estimated size:   `) + chalk.green.bold(estimatedSize))
  console.log('')

  // Category breakdown
  console.log(chalk.gray('    By category:'))
  for (const category of categoryOrder) {
    const count = groups[category].length
    if (count > 0) {
      const label = categoryLabels[category].padEnd(16)
      console.log(chalk.gray(`      ${label}`) + chalk.white(count.toString().padStart(3)) + chalk.gray(' files'))
    }
  }

  console.log('')

  // Locale information
  console.log(chalk.gray('    Locales configured:'))
  for (const locale of config.supportedLocales) {
    const isDefault = locale === config.defaultLocale
    const suffix = isDefault ? chalk.cyan(' (default)') : ''
    console.log(chalk.gray(`      - `) + chalk.white(locale) + suffix)
  }

  console.log('')
}
