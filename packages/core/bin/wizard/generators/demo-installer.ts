/**
 * Demo Theme Installer
 *
 * Installs the default demo theme to allow users to explore NextSpark features.
 * Searches for the theme in multiple locations and copies it to the project.
 */

import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import chalk from 'chalk'
import ora from 'ora'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Possible locations for the default demo theme
 */
const DEMO_THEME_PATHS = [
  // Relative to compiled location: bin/dist/wizard/generators/demo-installer.js
  path.resolve(__dirname, '../../../../templates/contents/themes/default'),
  // Alternative location in contents
  path.resolve(__dirname, '../../../../contents/themes/default'),
]

/**
 * Get the target themes directory in the user's project
 */
function getTargetThemesDir(): string {
  return path.resolve(process.cwd(), 'contents', 'themes')
}

/**
 * Find the demo theme source directory
 */
async function findDemoTheme(): Promise<string | null> {
  for (const themePath of DEMO_THEME_PATHS) {
    if (await fs.pathExists(themePath)) {
      return themePath
    }
  }
  return null
}

/**
 * Update theme.config.ts to enable the langchain plugin
 */
async function enableLangchainPlugin(themePath: string): Promise<void> {
  const themeConfigPath = path.join(themePath, 'config', 'theme.config.ts')

  if (!await fs.pathExists(themeConfigPath)) {
    // Config file doesn't exist, skip modification
    return
  }

  let content = await fs.readFile(themeConfigPath, 'utf-8')

  // Check if plugins array exists
  if (content.includes('plugins:')) {
    // Check if langchain is already in plugins
    if (!content.includes("'langchain'") && !content.includes('"langchain"')) {
      // Add langchain to existing plugins array
      content = content.replace(
        /plugins:\s*\[(.*?)\]/s,
        (match, plugins) => {
          const existingPlugins = plugins.trim()
          if (existingPlugins) {
            return `plugins: [${existingPlugins}, 'langchain']`
          }
          return `plugins: ['langchain']`
        }
      )
    }
  } else {
    // No plugins array exists, add it after description
    content = content.replace(
      /(description:\s*['"].*?['"],?\n)/,
      "$1\n  plugins: ['langchain'],\n"
    )
  }

  await fs.writeFile(themeConfigPath, content, 'utf-8')
}

/**
 * Install the demo theme to the user's project
 *
 * @returns true if installation was successful, false otherwise
 */
export async function installDemoTheme(): Promise<boolean> {
  const spinner = ora({
    text: 'Searching for demo theme...',
    prefixText: '  ',
  }).start()

  try {
    // Find the demo theme source
    const demoThemePath = await findDemoTheme()

    if (!demoThemePath) {
      spinner.fail(chalk.red('Demo theme not found'))
      console.log(chalk.gray('  Searched locations:'))
      for (const searchPath of DEMO_THEME_PATHS) {
        console.log(chalk.gray(`    - ${searchPath}`))
      }
      return false
    }

    spinner.text = 'Preparing installation directory...'

    // Prepare target directory
    const targetThemesDir = getTargetThemesDir()
    const targetDemoPath = path.join(targetThemesDir, 'default')

    // Check if demo theme already exists
    if (await fs.pathExists(targetDemoPath)) {
      spinner.warn(chalk.yellow('Demo theme already exists at: contents/themes/default'))
      console.log(chalk.gray('  Skipping installation to avoid overwriting existing files.'))
      return true
    }

    // Ensure themes directory exists
    await fs.ensureDir(targetThemesDir)

    spinner.text = 'Copying demo theme files...'

    // Copy the entire demo theme
    await fs.copy(demoThemePath, targetDemoPath)

    spinner.text = 'Configuring demo theme...'

    // Enable langchain plugin
    await enableLangchainPlugin(targetDemoPath)

    spinner.succeed(chalk.green('Demo theme installed successfully!'))

    // Show installation details
    console.log('')
    console.log(chalk.gray('  Demo theme location: ') + chalk.cyan('contents/themes/default/'))
    console.log(chalk.gray('  Enabled plugin: ') + chalk.cyan('langchain'))
    console.log('')
    console.log(chalk.yellow('  Remember: This is a demo for exploration only.'))
    console.log(chalk.yellow('  Complete the wizard to create your customized project.'))
    console.log('')

    return true
  } catch (error) {
    spinner.fail(chalk.red('Failed to install demo theme'))

    if (error instanceof Error) {
      console.log(chalk.red(`  Error: ${error.message}`))
    }

    return false
  }
}
