/**
 * Pages of the project that use React Query where `providers.scope: 'groups'` mounts no provider (#362). What counts as
 * one, and which core modules bring React Query in, is the installed core's: its maintenance module exports the search,
 * so `nextspark doctor` and `nextspark prepare` (which runs the same search over the route plan) agree. Read-only.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const MODULE = join('scripts', 'maintenance', 'query-providers.mjs')

export interface QueryHookFinding {
  route: string
  source: string
  import: string
  specifier: string
  fix: string
}

/**
 * The scope of the project and the pages that use React Query without a provider, or null when the core in `coreDir`
 * predates the search (it cannot say, so nothing is claimed).
 */
export async function findQueryHooks(root: string, coreDir: string): Promise<{ scope: string; findings: QueryHookFinding[] } | null> {
  const module = join(coreDir, MODULE)
  if (!existsSync(module)) return null
  const search = (await import(pathToFileURL(module).href)) as { findQueryHooksInProject?: (root: string) => Promise<{ scope: string; findings: QueryHookFinding[] }> }
  return (await search.findQueryHooksInProject?.(root)) ?? null
}
