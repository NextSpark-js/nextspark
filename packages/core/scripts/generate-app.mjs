/**
 * App Structure Generator
 *
 * Generates the /app directory from templates in core/templates/app/
 * Supports EJS templating with nextspark.config.ts values
 *
 * @module core/scripts/generate-app
 */

import { readFile, writeFile, mkdir, copyFile, readdir, stat } from 'fs/promises'
import { join, dirname, relative } from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Generate /app directory from templates
 *
 * Theme templates have priority over core templates.
 * To customize: create templates in contents/themes/[theme]/templates/app/
 *
 * @param {string} projectRoot - Project root directory
 * @param {object} config - NextSpark configuration (from nextspark.config.ts)
 */
export async function generateApp(projectRoot, config = null) {
  const coreTemplatesDir = join(__dirname, '../templates/app')
  const outputDir = join(projectRoot, 'app')

  console.log('📁 Generating app structure...')
  console.log(`  Core Templates: ${coreTemplatesDir}`)
  console.log(`  Output: ${outputDir}`)

  // Ensure core templates directory exists
  if (!existsSync(coreTemplatesDir)) {
    console.warn('⚠️  Core templates directory not found. Skipping app generation.')
    return
  }

  // Load project config if not provided
  if (!config) {
    const { loadNextSparkConfigSync } = await import('./build/config-loader.mjs')
    config = loadNextSparkConfigSync(projectRoot)
  }

  // Use default config if none exists
  const templateData = {
    config: config || {
      theme: 'default',
      plugins: [],
      features: {},
      app: {
        name: 'NextSpark App',
        description: 'Built with NextSpark'
      }
    }
  }

  // Get active theme for theme template priority
  const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME?.replace(/'/g, '') || config?.theme || 'default'
  const themeTemplatesDir = join(projectRoot, 'contents/themes', activeTheme, 'templates/app')

  // Process all templates (theme templates have priority)
  await processDirectory(coreTemplatesDir, outputDir, templateData, themeTemplatesDir)

  console.log('✅ App generated successfully')
}

/**
 * Process a directory recursively
 *
 * Theme templates have priority: if a file exists in themeTemplatesDir,
 * use that instead of the core template.
 *
 * @param {string} srcDir - Source core template directory
 * @param {string} destDir - Destination output directory
 * @param {object} templateData - Data for EJS templates
 * @param {string} themeTemplatesDir - Theme templates directory (for override priority)
 */
async function processDirectory(srcDir, destDir, templateData, themeTemplatesDir) {
  // Ensure destination directory exists
  await mkdir(destDir, { recursive: true })

  const entries = await readdir(srcDir, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name)
    const destPath = join(destDir, entry.name.replace('.ejs', ''))

    // Skip README and other documentation
    if (entry.name === 'README.md') {
      continue
    }

    if (entry.isDirectory()) {
      // Recursively process subdirectories
      const themeSubdir = join(themeTemplatesDir, entry.name)
      await processDirectory(srcPath, destPath, templateData, themeSubdir)
    } else {
      const relativePath = relative(destDir, destPath)

      // Check if theme has an override for this template
      const themeTemplatePath = join(themeTemplatesDir, entry.name)
      const templateSource = existsSync(themeTemplatePath) ? themeTemplatePath : srcPath

      if (templateSource === themeTemplatePath) {
        console.log(`  🎨 Theme override: ${relativePath}`)
      }

      // Process file
      if (entry.name.endsWith('.ejs')) {
        // Compile EJS template
        await processTemplate(templateSource, destPath, templateData)
      } else {
        // Copy static file
        await copyFile(templateSource, destPath)
        console.log(`  📄 Copied: ${relativePath}`)
      }
    }
  }
}

/**
 * Process an EJS template file
 *
 * @param {string} srcPath - Source template file
 * @param {string} destPath - Destination output file
 * @param {object} data - Template data
 */
async function processTemplate(srcPath, destPath, data) {
  // For now, we'll use simple string replacement
  // In npm mode, this would use the 'ejs' package
  const template = await readFile(srcPath, 'utf8')

  // Simple template rendering (replace <%= config.* %> patterns)
  let content = template

  // Replace simple config values
  content = content.replace(
    /<%= config\.app\?\.name \|\| '([^']+)' %>/g,
    data.config.app?.name || '$1'
  )
  content = content.replace(
    /<%= config\.app\?\.description \|\| '([^']+)' %>/g,
    data.config.app?.description || '$1'
  )

  // Ensure destination directory exists
  await mkdir(dirname(destPath), { recursive: true })

  // Write processed template
  await writeFile(destPath, content, 'utf8')

  const relativePath = relative(join(destPath, '../..'), destPath)
  console.log(`  ✨ Generated: ${relativePath}`)
}

/**
 * Get all files in a directory recursively
 *
 * @param {string} dir - Directory to scan
 * @returns {Promise<string[]>} Array of file paths
 */
async function getAllFiles(dir) {
  const files = []
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      const subFiles = await getAllFiles(fullPath)
      files.push(...subFiles)
    } else {
      files.push(fullPath)
    }
  }

  return files
}

// Direct execution support
if (import.meta.url === `file://${process.argv[1]}`) {
  const projectRoot = process.cwd()
  generateApp(projectRoot).catch((error) => {
    console.error('❌ App generation failed:', error.message)
    process.exit(1)
  })
}
