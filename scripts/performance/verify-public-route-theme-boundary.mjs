#!/usr/bin/env node
/**
 * Ensures server-only project configuration cannot reach public route chunks.
 *
 * This reads Next's page client-reference manifests and the referenced static
 * JavaScript. It needs a completed production build but no running server or
 * browser. The markers are deliberately values from apps/dev's project
 * configuration, rather than source paths or comments that minification may
 * erase.
 */

import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

export const FORBIDDEN_MARKERS = [
  { label: 'full theme registry', value: 'hasDashboardConfig' },
  { label: 'dashboard config', value: 'dashboard.search.placeholder' },
  { label: 'development config', value: 'carlos.mendoza@nextspark.dev' },
]

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(file, files)
    else if (entry.name === 'page_client-reference-manifest.js') files.push(file)
  }
  return files
}

function readManifest(manifestFile) {
  const context = { globalThis: {} }
  context.globalThis = context
  vm.runInNewContext(fs.readFileSync(manifestFile, 'utf8'), context)
  const entries = Object.entries(context.__RSC_MANIFEST ?? {})
  if (entries.length !== 1) throw new Error(`Could not read one client-reference manifest: ${manifestFile}`)
  const [route, manifest] = entries[0]
  return { route, manifest }
}

function clientFiles(manifest) {
  const files = new Set()
  for (const chunks of Object.values(manifest.entryJSFiles ?? {})) {
    for (const chunk of chunks) files.add(chunk)
  }
  for (const module of Object.values(manifest.clientModules ?? {})) {
    for (const chunk of module.chunks ?? []) {
      if (typeof chunk === 'string' && chunk.endsWith('.js')) files.add(chunk)
    }
  }
  return files
}

function isPublicRoute(route) {
  // Client-reference manifest keys retain route groups, while the served URL
  // does not. `/(templates)/dashboard/...` is therefore a dashboard route,
  // not a public one.
  const pathname = route.replace(/\/\([^/]+\)/g, '')
  return !/^\/(?:dashboard|devtools|superadmin|api)(?:\/|$)/.test(pathname)
}

function chunkPath(nextDir, chunk) {
  return path.join(nextDir, chunk.replace(/^\/_next\//, ''))
}

export function findPublicRouteThemeLeaks(nextDir, markers = FORBIDDEN_MARKERS) {
  const manifestRoot = path.join(nextDir, 'server', 'app')
  const leaks = []
  for (const manifestFile of walk(manifestRoot)) {
    const { route, manifest } = readManifest(manifestFile)
    if (!isPublicRoute(route)) continue
    for (const chunk of clientFiles(manifest)) {
      const file = chunkPath(nextDir, chunk)
      if (!fs.existsSync(file)) continue
      const content = fs.readFileSync(file, 'utf8')
      for (const marker of markers) {
        if (content.includes(marker.value)) {
          leaks.push({ route, chunk, ...marker })
        }
      }
    }
  }
  return leaks
}

export function verifyPublicRouteThemeBoundary(nextDir, markers = FORBIDDEN_MARKERS) {
  const leaks = findPublicRouteThemeLeaks(nextDir, markers)
  if (leaks.length > 0) {
    throw new Error(`Server-only theme configuration reached public route chunks:\n${leaks
      .map(leak => `- ${leak.label} (${JSON.stringify(leak.value)}) in ${leak.route}: ${leak.chunk}`)
      .join('\n')}`)
  }
}

function parseArgs(argv) {
  if (argv.length === 0) return 'apps/dev/.next'
  if (argv.length === 2 && argv[0] === '--next-dir') return argv[1]
  throw new Error('Usage: node scripts/performance/verify-public-route-theme-boundary.mjs [--next-dir apps/dev/.next]')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  verifyPublicRouteThemeBoundary(parseArgs(process.argv.slice(2)))
  console.log('Public route theme boundary: no full registry, dashboard config, or development config found.')
}
