/**
 * The activeTeamId cookie holds `<session id>:<team id>`. Code that read it as a
 * bare team id would act in a team no current session chose, and code that
 * wrote a bare team id would leave a value every reader ignores, so every read
 * and write goes through lib/teams/active-team-cookie.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const ROOTS = ['apps/dev/app', 'packages/core/src', 'packages/core/templates/proxy.ts', 'themes', 'plugins']
const SKIPPED_DIRS = new Set(['node_modules', '.next', 'dist', 'tests', '__tests__', 'cypress'])
/** A cookie accessor called with the literal name; localStorage's getItem/setItem is not a cookie. */
const DIRECT_COOKIE_ACCESS = /\.(?:get|set|delete|has)\(\s*['"`]activeTeamId['"`]/

function sourceFiles(entry: string): string[] {
  const full = path.join(REPO, entry)
  if (!fs.existsSync(full)) return []
  if (fs.statSync(full).isFile()) return [full]
  return fs.readdirSync(full, { withFileTypes: true }).flatMap(child => {
    if (child.isDirectory()) return SKIPPED_DIRS.has(child.name) ? [] : sourceFiles(path.join(entry, child.name))
    return /\.[cm]?[jt]sx?$/.test(child.name) ? [path.join(full, child.name)] : []
  })
}

test('nothing reads or writes the active team cookie except through its helper', () => {
  const direct = ROOTS.flatMap(sourceFiles).flatMap(file =>
    fs.readFileSync(file, 'utf8').split('\n')
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => DIRECT_COOKIE_ACCESS.test(line))
      .map(({ line, index }) => `${path.relative(REPO, file)}:${index + 1}: ${line.trim()}`)
  )

  assert.deepEqual(direct, [])
})

test('app code takes the dashboard team from getDashboardTeamId, not from the header', () => {
  // Reading x-active-team-id alone skips the permission check whenever the
  // session has not chosen a team yet; getDashboardTeamId falls back to the
  // user's default team instead.
  const direct = ['apps/dev/app', 'themes', 'plugins'].flatMap(sourceFiles).flatMap(file =>
    fs.readFileSync(file, 'utf8').split('\n')
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line.includes('x-active-team-id'))
      .map(({ line, index }) => `${path.relative(REPO, file)}:${index + 1}: ${line.trim()}`)
  )

  assert.deepEqual(direct, [])
})
