#!/usr/bin/env node

/**
 * NextSpark NPM Postinstall Hook
 *
 * Ejecutado automáticamente después de `npm install @nextsparkjs/core`
 * Solo se ejecuta si existe nextspark.config.ts en el proyecto
 *
 * Este script diferencia entre dos modos:
 * - NPM Mode: Instalado como paquete npm en un proyecto externo
 * - Dev Mode: Ejecutado en el proyecto sass-boilerplate
 *
 * En NPM Mode:
 * - Busca nextspark.config.ts en el proyecto
 * - Genera registries en .nextspark/
 * - Genera /app desde templates si no existe
 * - Configura tsconfig.json paths
 *
 * En Dev Mode (no hace nada):
 * - Usa postinstall.mjs existente
 *
 * Usage:
 *   node core/scripts/setup/npm-postinstall.mjs
 *   (or automatically via package.json postinstall hook)
 */

import { existsSync, readdirSync, copyFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Find project root by searching for nextspark.config.ts
 * Walks up from cwd until root or config file is found
 *
 * @returns {string|null} Project root path or null if not found
 */
async function findProjectRoot() {
  let dir = process.cwd()
  const root = process.platform === 'win32' ? dir.split(':')[0] + ':/' : '/'

  // Walk up directory tree
  while (dir !== root) {
    const configPath = join(dir, 'nextspark.config.ts')
    if (existsSync(configPath)) {
      return dir
    }
    dir = dirname(dir)
  }

  // Check root directory itself
  const configPath = join(root, 'nextspark.config.ts')
  if (existsSync(configPath)) {
    return root
  }

  return null
}

/**
 * Copy generated registries to package dist/lib/registries
 * This allows the compiled package code to import registries
 * that are specific to the consuming project
 *
 * @param {string} projectRoot - Project root path
 */
async function copyRegistriesToPackageDist(projectRoot) {
  const sourceDir = join(projectRoot, '.nextspark/registries')
  const targetDir = join(projectRoot, 'node_modules/@nextsparkjs/core/dist/lib/registries')

  // Ensure source directory exists
  if (!existsSync(sourceDir)) {
    console.warn('   ⚠️  Warning: .nextspark/registries not found, skipping copy')
    return
  }

  // Ensure target directory exists
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true })
  }

  // Get all .ts and .js files from source
  const files = readdirSync(sourceDir).filter(file =>
    file.endsWith('.ts') || file.endsWith('.js')
  )

  if (files.length === 0) {
    console.warn('   ⚠️  Warning: No registry files found in .nextspark/registries')
    return
  }

  // Copy each file
  let copiedCount = 0
  for (const file of files) {
    const sourcePath = join(sourceDir, file)
    const targetPath = join(targetDir, file)

    try {
      copyFileSync(sourcePath, targetPath)
      copiedCount++
    } catch (error) {
      console.warn(`   ⚠️  Warning: Failed to copy ${file}: ${error.message}`)
    }
  }

  console.log(`   ✅ Copied ${copiedCount} registry files to package dist/`)
}

/**
 * Main postinstall function
 */
async function postinstall() {
  const projectRoot = await findProjectRoot()

  // Si no hay nextspark.config.ts, estamos en modo desarrollo o siendo
  // instalados como dependencia transitiva - no hacer nada
  if (!projectRoot) {
    // Silent exit - this is normal when installed as a dependency
    // or during development in sass-boilerplate
    return
  }

  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🚀 Setting up NextSpark...')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log(`📁 Project root: ${projectRoot}`)
  console.log('')

  try {
    // 1. Build registries
    console.log('🔧 Building registries...')
    const { buildRegistries } = await import('../build/registry.mjs')
    await buildRegistries(projectRoot)
    console.log('   ✅ Registries generated')

    // 2. Build theme CSS
    console.log('')
    console.log('🎨 Building theme...')
    const { buildTheme } = await import('../build/theme.mjs')
    await buildTheme(projectRoot)
    console.log('   ✅ Theme built')

    // 3. Generate app structure (solo si no existe o está vacío)
    const appDir = join(projectRoot, 'app')
    if (!existsSync(appDir)) {
      console.log('')
      console.log('📁 Generating app structure...')
      const { generateApp } = await import('../generate-app.mjs')
      await generateApp(projectRoot)
      console.log('   ✅ App structure generated')
    } else {
      console.log('')
      console.log('📁 App directory exists, skipping generation')
    }

    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ NextSpark ready!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')
    console.log('Next steps:')
    console.log('  1. Configure .env with your DATABASE_URL')
    console.log('  2. Run: pnpm db:migrate')
    console.log('  3. Run: pnpm dev (or npx nextspark dev)')
    console.log('')

  } catch (error) {
    console.error('')
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('❌ Setup failed:', error.message)
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('')

    if (process.env.NEXTSPARK_DEBUG) {
      console.error('Stack trace:')
      console.error(error.stack)
    } else {
      console.error('Run with NEXTSPARK_DEBUG=1 for full error details')
    }

    console.error('')
    // No salir con error - postinstall no debería bloquear npm install
    // Solo reportar el error para que el usuario lo vea
    // process.exit(1)
  }
}

// Run postinstall
postinstall()
