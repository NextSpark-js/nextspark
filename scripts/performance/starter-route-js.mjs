#!/usr/bin/env node
/**
 * Per-route client JavaScript of a built NextSpark project, checked against a budget.
 *
 * Reads the production build only (no server, browser or session): a route's JavaScript is what its HTML loads
 * before any interaction - the app's root main files (`build-manifest.json`) and the chunks of every layout and
 * page of the route (the `entryJSFiles` of its client reference manifest). That is the HTML script list minus the
 * `nomodule` polyfill, which a modern browser skips. Sizes are gzip (the compression `next start` applies), with a
 * trailing `sourceMappingURL` comment removed so a build with browser source maps measures like one without.
 *
 * The budget (starter-route-js-budget.json) gives each route a gzip ceiling, and for the routes a signed-out visitor
 * loads, strings that only dashboard, superadmin or devtools code carries and that must not be in their chunks.
 *
 *   node scripts/performance/starter-route-js.mjs --app <project dir> [--budget <file>] [--json <out file>]
 *
 * Exit 0 when every route is within budget, 1 when one is not, 2 on a usage or build-output error.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const DEFAULT_BUDGET = fileURLToPath(new URL('./starter-route-js-budget.json', import.meta.url))
const SOURCE_MAP_COMMENT = /\n?\/\/# sourceMappingURL=\S+\s*$/

/**
 * The client reference manifest key (`/(public)/support/page`) that serves a URL (`/support`): the route of that exact
 * pathname, else the most specific dynamic route that matches it - the most static segments, then the fewest dynamic
 * ones (`/dashboard/[entity]` for `/dashboard/tasks` in a project that has no route of its own for it).
 */
export function routeKeyFor(routesByKey, url) {
  const segments = url.split('/').filter(Boolean)
  let best = null
  for (const [key, pattern] of Object.entries(routesByKey)) {
    if (!key.endsWith('/page')) continue
    if (pattern === url) return key
    const parts = pattern.split('/').filter(Boolean)
    let statics = 0, dynamic = 0, index = 0, matches = true
    for (const part of parts) {
      if (/^\[\[?\.\.\./.test(part)) {
        const optional = part.startsWith('[[')
        if (!optional && index >= segments.length) matches = false
        dynamic += 100
        index = segments.length
        break
      }
      if (index >= segments.length) { matches = false; break }
      if (/^\[.+\]$/.test(part)) dynamic++
      else if (part === segments[index]) statics++
      else { matches = false; break }
      index++
    }
    const better = !best || statics > best.statics || (statics === best.statics && dynamic < best.dynamic)
    if (matches && index === segments.length && better) best = { key, statics, dynamic }
  }
  return best?.key ?? null
}

function routeFiles(nextDir, key, rootMainFiles) {
  const file = path.join(nextDir, 'server/app', `${key.slice(1)}_client-reference-manifest.js`)
  if (!existsSync(file)) throw new Error(`no client reference manifest for ${key} (${file})`)
  const sandbox = { self: {} }
  sandbox.globalThis = sandbox
  vm.runInNewContext(readFileSync(file, 'utf8'), sandbox)
  const manifest = sandbox.self.__RSC_MANIFEST?.[key] ?? sandbox.__RSC_MANIFEST?.[key]
  if (!manifest?.entryJSFiles) throw new Error(`${file} has no entryJSFiles for ${key}`)
  return [...new Set([...rootMainFiles, ...Object.values(manifest.entryJSFiles).flat()])]
}

/**
 * Measure the routes of a built project.
 * @returns {Record<string, { files: number, rawBytes: number, gzipBytes: number, markers: string[] }>}
 */
export function measureRoutes({ app, routes, markers = [] }) {
  const nextDir = path.join(app, '.next')
  const routesByKey = JSON.parse(readFileSync(path.join(nextDir, 'app-path-routes-manifest.json'), 'utf8'))
  const { rootMainFiles } = JSON.parse(readFileSync(path.join(nextDir, 'build-manifest.json'), 'utf8'))
  const chunks = new Map()
  const chunk = file => {
    if (!chunks.has(file)) {
      const text = readFileSync(path.join(nextDir, file), 'utf8').replace(SOURCE_MAP_COMMENT, '')
      const buffer = Buffer.from(text)
      chunks.set(file, { text, raw: buffer.length, gzip: gzipSync(buffer).length })
    }
    return chunks.get(file)
  }
  const result = {}
  for (const url of routes) {
    const key = routeKeyFor(routesByKey, url)
    if (!key) throw new Error(`the build has no app route for ${url}`)
    const files = routeFiles(nextDir, key, rootMainFiles).map(chunk)
    result[url] = {
      files: files.length,
      rawBytes: files.reduce((sum, file) => sum + file.raw, 0),
      gzipBytes: files.reduce((sum, file) => sum + file.gzip, 0),
      markers: markers.filter(marker => files.some(file => file.text.includes(marker))),
    }
  }
  return result
}

/** Problems of a measurement against a budget (empty when within budget). */
export function checkBudget(budget, measured) {
  const problems = []
  for (const [url, rule] of Object.entries(budget.routes)) {
    const route = measured[url]
    if (!route) {
      problems.push(`${url}: not measured`)
      continue
    }
    if (route.gzipBytes > rule.maxGzipBytes) {
      problems.push(`${url}: ${route.gzipBytes} gzip bytes of JavaScript, over the budget of ${rule.maxGzipBytes} (+${route.gzipBytes - rule.maxGzipBytes})`)
    }
    if (rule.public) {
      for (const marker of route.markers) problems.push(`${url}: a signed-out route loads dashboard-only code (${JSON.stringify(marker)} is in its chunks)`)
    }
  }
  return problems
}

export function validateBudget(budget) {
  const problems = []
  if (budget?.kind !== 'starter-route-js-budget' || budget.schemaVersion !== 1) problems.push('kind must be "starter-route-js-budget" and schemaVersion 1')
  if (!Array.isArray(budget?.dashboardOnlyMarkers) || budget.dashboardOnlyMarkers.some(marker => typeof marker !== 'string' || marker.length < 6)) {
    problems.push('dashboardOnlyMarkers must be an array of strings of 6 characters or more')
  }
  const routes = Object.entries(budget?.routes ?? {})
  if (routes.length === 0) problems.push('routes must not be empty')
  for (const [url, rule] of routes) {
    if (!url.startsWith('/')) problems.push(`${url}: a route is a pathname`)
    if (!Number.isSafeInteger(rule?.maxGzipBytes) || rule.maxGzipBytes <= 0) problems.push(`${url}: maxGzipBytes must be a positive integer`)
    if (typeof rule?.public !== 'boolean') problems.push(`${url}: public must be a boolean`)
  }
  return problems
}

function parseArguments(argv) {
  const options = { budget: DEFAULT_BUDGET }
  for (let index = 0; index < argv.length; index++) {
    const name = argv[index]
    if (!['--app', '--budget', '--json'].includes(name) || !argv[index + 1]) throw new Error(`usage: starter-route-js.mjs --app <dir> [--budget <file>] [--json <file>] (got ${name})`)
    options[name.slice(2)] = argv[++index]
  }
  if (!options.app) throw new Error('--app is required')
  return options
}

function main() {
  let options, budget, measured
  try {
    options = parseArguments(process.argv.slice(2))
    budget = JSON.parse(readFileSync(options.budget, 'utf8'))
    const invalid = validateBudget(budget)
    if (invalid.length > 0) throw new Error(`invalid budget ${options.budget}:\n  ${invalid.join('\n  ')}`)
    measured = measureRoutes({ app: options.app, routes: Object.keys(budget.routes), markers: budget.dashboardOnlyMarkers })
  } catch (error) {
    console.error(error.message)
    return 2
  }
  if (options.json) writeFileSync(options.json, JSON.stringify(measured, null, 2) + '\n')
  const kb = bytes => (bytes / 1024).toFixed(1)
  for (const [url, route] of Object.entries(measured)) {
    const rule = budget.routes[url]
    console.log(`${url.padEnd(30)} ${String(route.files).padStart(3)} files  ${kb(route.gzipBytes).padStart(7)} kB gzip / ${kb(rule.maxGzipBytes)} kB budget${route.markers.length ? `  markers: ${route.markers.join(', ')}` : ''}`)
  }
  const problems = checkBudget(budget, measured)
  if (problems.length > 0) {
    console.error(`\nRoute JavaScript over budget:\n  ${problems.join('\n  ')}`)
    return 1
  }
  console.log('\nEvery route is within its JavaScript budget.')
  return 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main()
