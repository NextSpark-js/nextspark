/**
 * React Query Without a Provider Check
 *
 * With `providers.scope: 'groups'` the root layout mounts no React Query provider: a page, layout or block of the
 * project outside the dashboard, superadmin and devtools areas that reaches React Query throws "No QueryClient set"
 * unless a layout above it wraps its children in GroupProviders (#362). Only 'groups' is looked at.
 */

import type { HealthCheckResult } from '../index.js'
import { getCoreDir } from '../../utils/paths.js'
import { findQueryHooks } from '../../utils/query-hook-findings.js'

export async function checkQueryHooksWithoutProvider(): Promise<HealthCheckResult> {
  const name = 'React Query providers'
  let result: Awaited<ReturnType<typeof findQueryHooks>>
  try {
    result = await findQueryHooks(process.cwd(), getCoreDir())
  } catch (error) {
    // Only a notice: a project whose files cannot be looked at is not failing
    return { name, status: 'warn', message: `Could not look for pages that use React Query: ${error instanceof Error ? error.message : String(error)}` }
  }
  if (!result) return { name, status: 'pass', message: 'Not checked: this @nextsparkjs/core has no check for it' }
  if (result.scope !== 'groups') return { name, status: 'pass', message: `providers.scope is '${result.scope}': the root layout mounts the provider` }
  if (result.findings.length === 0) return { name, status: 'pass', message: "providers.scope is 'groups' and no page outside the dashboard uses React Query" }
  const shown = result.findings.slice(0, 3).map(finding => `${finding.route} -> ${finding.import}`).join(', ') + (result.findings.length > 3 ? ` (+${result.findings.length - 3} more)` : '')
  return {
    name,
    status: 'warn',
    code: 'NS_QUERY_HOOK_WITHOUT_PROVIDER',
    message: `NS_QUERY_HOOK_WITHOUT_PROVIDER: providers.scope is 'groups' and ${result.findings.length} route file${result.findings.length === 1 ? '' : 's'} use${result.findings.length === 1 ? 's' : ''} React Query with no provider above (${shown})`,
    fix: result.findings[0].fix.replace(/^wrap/, 'Wrap') + ", or set providers.scope to 'root'",
  }
}
