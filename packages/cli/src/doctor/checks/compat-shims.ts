/**
 * Compatibility shims (#439)
 *
 * `nextspark migrate` keeps a project from 0.x working the way it did, and some of what it leaves behind stays after the
 * migration: the rewrites from the old API URLs, the routes that accept any API key, the leftovers of the theme selection.
 * None of them is broken; each one has a reason to exist and a time to go. This lists the ones the project still has, with
 * where each is, what may still depend on it and how to remove it on its own. Static and read-only: no database, no app.
 * A project created by the wizard has none.
 *
 * Level: warn, like the other findings that are not failures (it never changes the exit code). doctor has no lower level.
 */

import fs from 'fs-extra'
import path from 'path'
import type { HealthCheckResult } from '../index.js'
import { getCoreDir } from '../../utils/paths.js'
import { findApiKeyScopeProblems } from '../../utils/api-key-scope-findings.js'
import { COMPAT_MARKER } from '../../utils/migrate-extras.js'

const NEXT_CONFIGS = ['next.config.ts', 'next.config.mts', 'next.config.mjs', 'next.config.js', 'next.config.cjs']
const THEME_NAMES = ['NEXT_PUBLIC_ACTIVE_THEME', 'ROOT_FIRST_PROJECT']
const CODE_FILE = /\.[cm]?[jt]sx?$/
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.next', 'dist', 'build', 'out', 'coverage', '.turbo', '.git', '.nextspark'])
const lineOf = (text: string, index: number) => text.slice(0, index).split('\n').length
const shown = (items: string[], limit = 4) => items.slice(0, limit).join(', ') + (items.length > limit ? ` (+${items.length - limit} more)` : '')

/** The rewrites of the old API URLs in next.config: the block migrate wrote (certain), or entries that look like it (merged by hand). */
async function rewriteShim(cwd: string): Promise<HealthCheckResult | null> {
  for (const file of NEXT_CONFIGS) {
    const text = await fs.readFile(path.join(cwd, file), 'utf-8').catch(() => null)
    if (text === null) continue
    const marker = text.indexOf(COMPAT_MARKER)
    const entries = [...text.matchAll(/source:\s*["'`](\/api\/v1\/(?:theme|plugin)\/[^"'`]+)["'`]/g)]
    if (marker === -1 && entries.length === 0) return null
    const urls = entries.map(match => match[1])
    const where = `${file}:${lineOf(text, marker !== -1 ? marker : entries[0].index ?? 0)}`
    return {
      name: 'Compat: rewrite',
      status: 'warn',
      code: 'NS_COMPAT_API_REWRITE',
      message: `NS_COMPAT_API_REWRITE: ${where} rewrites the old API URLs${urls.length ? ` (${shown(urls)})` : ''} to /api/**. It exists for clients that still call the old paths (installed mobile apps, integrations, stored URLs)${marker === -1 ? '; it has no nextspark-compat marker, so it was merged by hand and is recognized only by its source paths' : ''}. Nothing here can tell whether those clients are gone: check the requests your server still gets on those paths`,
      fix: marker !== -1
        ? `Once no client calls them, delete the nextspark-compat-rewrites block at the end of ${file} and put the config back as the default export (rename __nextspark_user_config back to \`export default\`)`
        : `Once no client calls them, delete those entries from the rewrites() of ${file}`,
    }
  }
  return null
}

/** The calls with allowAnyScope: true: 0.x let any valid key through, and migrate leaves the routes as they were. */
async function anyScopeShim(cwd: string): Promise<{ result: HealthCheckResult | null; note?: string }> {
  let found: Awaited<ReturnType<typeof findApiKeyScopeProblems>>
  try {
    found = await findApiKeyScopeProblems(cwd, getCoreDir())
  } catch (error) {
    return { result: null, note: `routes with allowAnyScope not checked: ${error instanceof Error ? error.message : String(error)}` }
  }
  if (!found) return { result: null, note: 'routes with allowAnyScope not checked: this @nextsparkjs/core has no check for it' }
  if (!found.checked) return { result: null, note: `routes with allowAnyScope not checked: ${found.reason}` }
  const calls = found.anyScope ?? []
  if (calls.length === 0) return { result: null }
  return {
    result: {
      name: 'Compat: API keys',
      status: 'warn',
      code: 'NS_COMPAT_ALLOW_ANY_SCOPE',
      message: `NS_COMPAT_ALLOW_ANY_SCOPE: ${calls.length} call${calls.length === 1 ? '' : 's'} pass allowAnyScope: true, so the route accepts any valid API key whatever its scopes (${shown(calls.map(found.describe))}). 0.x routes did this by default, and a migrated project keeps them; a route that does it on purpose is fine, and this cannot tell which ones are`,
      fix: "To narrow a route, pass { requiredScope: '<scope>' } instead (declare a scope of your own in api.scopes of config/app.config.ts, or apiScopes in a plugin); keys then need that scope or the wildcard, so create or update the keys the integrations use first",
    },
  }
}

/** The code files of the project (not dependencies, build output or the generated src/app), as paths relative to `cwd`. */
async function codeFiles(cwd: string, directory = ''): Promise<string[]> {
  const files: string[] = []
  for (const entry of await fs.readdir(path.join(cwd, directory), { withFileTypes: true }).catch(() => [])) {
    const relative = directory ? `${directory}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name) && relative !== 'src/app') files.push(...(await codeFiles(cwd, relative)))
    } else if (entry.isFile() && CODE_FILE.test(entry.name)) files.push(relative)
  }
  return files
}

/** Mentions of the theme variable in the .env* files and the scripts of package.json. */
async function themeShim(cwd: string): Promise<HealthCheckResult | null> {
  const places: string[] = []
  for (const entry of (await fs.readdir(cwd).catch(() => [] as string[])).filter(file => file === '.env' || file.startsWith('.env.')).sort()) {
    const text = await fs.readFile(path.join(cwd, entry), 'utf-8').catch(() => '')
    text.split('\n').forEach((line, index) => {
      if (!line.trim().startsWith('#') && THEME_NAMES.some(variable => line.includes(variable))) places.push(`${entry}:${index + 1}`)
    })
  }
  const packageText = await fs.readFile(path.join(cwd, 'package.json'), 'utf-8').catch(() => '')
  let scripts: Record<string, unknown> = {}
  try {
    scripts = (JSON.parse(packageText) as { scripts?: Record<string, unknown> }).scripts ?? {}
  } catch {
    // an unreadable package.json is reported by other checks
  }
  for (const [script, value] of Object.entries(scripts)) {
    if (typeof value === 'string' && THEME_NAMES.some(variable => value.includes(variable))) {
      const at = packageText.indexOf(`"${script}"`)
      places.push(`package.json:${at === -1 ? 1 : lineOf(packageText, at)} (script ${script})`)
    }
  }
  // ROOT_FIRST_PROJECT is what an earlier migrate wrote in place of the variable: it gives no false positives in code
  for (const file of (await codeFiles(cwd)).sort()) {
    const text = await fs.readFile(path.join(cwd, file), 'utf-8').catch(() => '')
    text.split('\n').forEach((line, index) => {
      if (line.includes('ROOT_FIRST_PROJECT')) places.push(`${file}:${index + 1}`)
    })
  }
  if (places.length === 0) return null
  return {
    name: 'Compat: theme',
    status: 'warn',
    code: 'NS_COMPAT_THEME_LEFTOVER',
    message: `NS_COMPAT_THEME_LEFTOVER: ${shown(places, 6)} still sets or names the theme (NEXT_PUBLIC_ACTIVE_THEME or ROOT_FIRST_PROJECT). A root-first project is its own theme and nothing reads either. The .env* files, the package.json scripts and ROOT_FIRST_PROJECT in code are looked at; NEXT_PUBLIC_ACTIVE_THEME in code is not (migrate already turned its reads into undefined): find it with git grep -n -e NEXT_PUBLIC_ACTIVE_THEME -e ROOT_FIRST_PROJECT`,
    fix: "Delete those lines (and the same variable in the deployment's environment); in a script keep the command and drop the variable assignment",
  }
}

/** One result per shim the project still has, or a single pass when it has none. */
export async function checkCompatShims(cwd = process.cwd()): Promise<HealthCheckResult[]> {
  const scopes = await anyScopeShim(cwd)
  // The note that the routes were not read must not be lost when other shims are listed
  const notChecked: HealthCheckResult | null = scopes.note ? { name: 'Compat: API keys', status: 'warn', message: scopes.note.charAt(0).toUpperCase() + scopes.note.slice(1), fix: 'Fix what the reason says, then run nextspark doctor again' } : null
  const found = [await rewriteShim(cwd), scopes.result, await themeShim(cwd)]
  const results = [found[0], scopes.result ?? notChecked, found[2]].filter((result): result is HealthCheckResult => result !== null)
  if (results.length > 0) return results
  return [{ name: 'Compat shims', status: 'pass', message: 'No 0.x compatibility shims (rewrites of the old API URLs, routes with allowAnyScope, theme leftovers)' }]
}
