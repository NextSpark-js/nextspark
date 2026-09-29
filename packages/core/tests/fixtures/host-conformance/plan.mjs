/**
 * The fixture's route plan: which module implements each src/app file, resolved the way
 * `nextspark prepare` would - core defaults from the (fake) core package, replaced by a project
 * `templates/` file at the same path, plus project `api/` and plugin `api/` route handlers.
 * Shared by the generator (to emit facades) and the conformance script (to map build output of
 * both hosts back to the same source module).
 */
import { readdirSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CORE_ROUTES } from './fake-core/routes.mjs'
import { kindForFileStem } from '../../../scripts/build/registry/host/facade-emitter.mjs'

export const FIXTURE_ROOT = dirname(fileURLToPath(import.meta.url))
export const SOURCE_ROOT = join(FIXTURE_ROOT, 'source')
export const FAKE_CORE_ROOT = join(FIXTURE_ROOT, 'fake-core')
export const HOSTS = ['manual', 'generated']
export const MODES = ['isr', 'cc']
export const BUNDLERS = ['webpack', 'turbopack']

// `icon1.tsx`, `opengraph-image2.tsx`: Next's one-digit metadata image variants.
const SOURCE_FILE = /^(?<name>[a-z-]+\d?)(?:\.(?<mode>isr|cc))?\.(?<ext>tsx|ts)$/

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
  )
}

const toPosix = path => path.split(sep).join('/')
const withoutExtension = path => path.replace(/\.(tsx|ts)$/, '')

function sourceRoutes(surface, toTarget) {
  const base = join(SOURCE_ROOT, surface)
  const routes = []
  for (const file of walk(base)) {
    const relativePath = toPosix(relative(base, file))
    const match = SOURCE_FILE.exec(relativePath.split('/').at(-1))
    const kind = match && kindForFileStem(match.groups.name)
    if (!kind) continue
    const target = toTarget(relativePath)
    if (target === null) continue
    routes.push({
      kind,
      target,
      mode: match.groups.mode ?? null,
      specifier: `@/${surface}/${withoutExtension(relativePath)}`,
      file,
      origin: 'project',
    })
  }
  return routes
}

/**
 * Every src/app file of the host, sorted by target. Throws on a collision the plan cannot
 * resolve (two project sources for one target); a project template replacing a core default is
 * the intended override.
 */
export function resolveRoutePlan() {
  const byTarget = new Map()
  for (const route of CORE_ROUTES) {
    const file = join(FAKE_CORE_ROOT, `${route.specifier.replace('@fixture-core/', '')}.tsx`)
    byTarget.set(route.target, { ...route, mode: null, file, origin: 'core' })
  }

  const projectRoutes = [
    ...sourceRoutes('templates', path => path),
    ...sourceRoutes('api', path => `api/${path}`),
    ...sourceRoutes('plugins', path => {
      const [plugin, surface, ...rest] = path.split('/')
      return surface === 'api' ? `api/plugins/${plugin}/${rest.join('/')}` : null
    }),
  ]
  for (const route of projectRoutes) {
    const existing = byTarget.get(route.target)
    if (existing && existing.origin === 'project') {
      throw new Error(`Route collision at src/app/${route.target}: ${existing.file} and ${route.file}`)
    }
    byTarget.set(route.target, existing ? { ...route, overrides: existing.specifier } : route)
  }
  return [...byTarget.values()].sort((a, b) => a.target.localeCompare(b.target))
}

/** Entity registry inputs: one server config and one client-safe config per entity. */
export function resolveEntities() {
  return readdirSync(join(SOURCE_ROOT, 'entities'), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()
}
