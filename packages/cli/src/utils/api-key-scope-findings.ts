/**
 * Routes of the project whose API-key scopes are missing or undeclared (#426). What counts as a finding is the installed
 * core's: its maintenance module reads the host plan the way `nextspark prepare` does, so `nextspark doctor` and
 * `nextspark prepare` list the same routes. Read-only.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const MODULE = join('scripts', 'maintenance', 'api-key-scopes.mjs')

export interface ApiKeyScopeFinding {
  url: string
  source: string
  line: number
  method: string | null
  call: string
  scope?: string
}

export interface ApiKeyScopeFindings {
  /** False, with the reason, when the project has no host plan to read. */
  checked: boolean
  reason?: string
  withoutScope: ApiKeyScopeFinding[]
  undeclared: ApiKeyScopeFinding[]
  describe: (finding: ApiKeyScopeFinding) => string
  fixes: { withoutScope: string; undeclared: string }
}

/** The findings for the project at `root`, or null when the core in `coreDir` predates the search (it cannot say, so nothing is claimed). */
export async function findApiKeyScopeProblems(root: string, coreDir: string): Promise<ApiKeyScopeFindings | null> {
  const module = join(coreDir, MODULE)
  if (!existsSync(module)) return null
  const search = (await import(pathToFileURL(module).href)) as {
    findApiKeyScopeProblemsInProject?: (root: string) => Promise<Omit<ApiKeyScopeFindings, 'describe' | 'fixes'>>
    describeApiKeyFinding: ApiKeyScopeFindings['describe']
    NO_SCOPE_FIX: string
    UNDECLARED_SCOPE_FIX: string
  }
  const found = await search.findApiKeyScopeProblemsInProject?.(root)
  if (!found) return null
  return { ...found, describe: search.describeApiKeyFinding, fixes: { withoutScope: search.NO_SCOPE_FIX, undeclared: search.UNDECLARED_SCOPE_FIX } }
}
