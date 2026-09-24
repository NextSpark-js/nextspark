#!/usr/bin/env node

/** Build project-owned root-first styles. */

import { existsSync, readFileSync, watch } from 'fs'
import path from 'path'
import { getConfig } from './registry/config.mjs'
import { projectGeneratedAppDir } from './registry/project-mode.mjs'
import { projectFiles } from './safe-fs.mjs'
import { rewriteBelowGeneratedTag } from '../utils/generated-tag.mjs'

export function syncAppGlobalsCss(config) {
  const generatedAppDir = config.generatedAppDir || projectGeneratedAppDir(config.projectRoot)
  const appGlobalsCssPath = path.join(generatedAppDir, 'globals.css')
  const relativePath = path.relative(generatedAppDir, path.join(config.projectSourceDir, 'styles', 'globals.css')).replace(/\\/g, '/')
  const expectedImport = `@import "${relativePath}";`
  const template = `/* =============================================
   GLOBAL STYLES - Import from project styles

   This file is generated. Customize styles/globals.css instead.
   ============================================= */

${expectedImport}
`

  if (existsSync(appGlobalsCssPath)) {
    const currentContent = readFileSync(appGlobalsCssPath, 'utf8')
    const importMatch = currentContent.match(/@import\s+["']([^"']+)["'];?/)
    if (importMatch?.[1] === relativePath) return false
    if (importMatch) {
      const updatedContent = rewriteBelowGeneratedTag(currentContent, body =>
        body.replace(/@import\s+["'][^"']+["'];?/, expectedImport)
      )
      projectFiles(config.projectRoot).writeFileSync(appGlobalsCssPath, updatedContent)
      return true
    }
  }

  projectFiles(config.projectRoot).writeFileSync(appGlobalsCssPath, template)
  return true
}

function validateThemeCSS(cssContent) {
  const required = ['@import "tailwindcss"', ':root', '.dark', '@theme', '--background:', '--primary:', '--color-background:']
  const missing = required.filter(pattern => !cssContent.includes(pattern))
  if (missing.length > 0) {
    console.warn(`   ⚠️  styles/globals.css is missing: ${missing.join(', ')}`)
    return false
  }
  return true
}

export async function buildTheme(projectRoot = null) {
  const config = getConfig(projectRoot)
  const outputDir = path.join(config.projectRoot, '.next')
  const outputPath = path.join(outputDir, 'theme-generated.css')
  const globalStylesPath = path.join(config.projectSourceDir, 'styles', 'globals.css')
  const componentStylesPath = path.join(config.projectSourceDir, 'styles', 'components.css')

  projectFiles(config.projectRoot).mkdirSync(outputDir, { recursive: true })
  syncAppGlobalsCss(config)

  const globalCSS = existsSync(globalStylesPath) ? readFileSync(globalStylesPath, 'utf8') : ''
  const componentCSS = existsSync(componentStylesPath) ? readFileSync(componentStylesPath, 'utf8') : ''
  if (globalCSS) validateThemeCSS(globalCSS)

  const finalCSS = `/* Generated project theme CSS. Do not edit. */\n\n${globalCSS}\n\n${componentCSS}\n`
  projectFiles(config.projectRoot).writeFileSync(outputPath, finalCSS)
  console.log(`✅ Project styles built: ${outputPath} (${finalCSS.length} chars)`)
}

async function watchTheme() {
  const config = getConfig()
  const stylesPath = path.join(config.projectSourceDir, 'styles')
  console.log(`👀 Watching project styles: ${stylesPath}`)
  let debounceTimer = null
  const watcher = watch(stylesPath, { recursive: true }, (_eventType, filename) => {
    if (!filename?.endsWith('.css')) return
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => buildTheme(), 300)
  })
  process.on('SIGINT', () => {
    watcher.close()
    process.exit(0)
  })
}

const isMainScript = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())
if (isMainScript) {
  await buildTheme()
  if (process.argv.includes('--watch') || process.argv.includes('-w')) await watchTheme()
}
