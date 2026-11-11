/**
 * API-Key Scopes Check
 *
 * A route that authenticates API keys without declaring requiredScope or allowAnyScope refuses every key at runtime
 * (403 SCOPE_NOT_DECLARED), and a route that requires a scope nothing declares can only be passed by a wildcard key
 * (the scope cannot be minted). Both show only request by request in production, so they are listed here (#426).
 */

import type { HealthCheckResult } from '../index.js'
import { getCoreDir } from '../../utils/paths.js'
import { findApiKeyScopeProblems, type ApiKeyScopeFinding } from '../../utils/api-key-scope-findings.js'

const shown = (findings: ApiKeyScopeFinding[], describe: (finding: ApiKeyScopeFinding) => string) =>
  findings.slice(0, 3).map(describe).join(', ') + (findings.length > 3 ? ` (+${findings.length - 3} more)` : '')

export async function checkApiKeyScopes(): Promise<HealthCheckResult> {
  const name = 'API key scopes'
  let result: Awaited<ReturnType<typeof findApiKeyScopeProblems>>
  try {
    result = await findApiKeyScopeProblems(process.cwd(), getCoreDir())
  } catch (error) {
    // Only a notice: a project whose routes cannot be looked at is not failing
    return { name, status: 'warn', message: `Could not look for routes without an API key scope: ${error instanceof Error ? error.message : String(error)}` }
  }
  if (!result) return { name, status: 'pass', message: 'Not checked: this @nextsparkjs/core has no check for it' }
  if (!result.checked) return { name, status: 'pass', message: `Not checked: ${result.reason}` }
  const { withoutScope, undeclared, describe, fixes } = result
  if (withoutScope.length === 0 && undeclared.length === 0) return { name, status: 'pass', message: 'Every route that authenticates API keys declares a scope that exists' }
  // The routes that refuse every key come first: they are the ones that fail today
  const first = withoutScope.length > 0
  const code = first ? 'NS_API_KEY_ROUTE_WITHOUT_SCOPE' : 'NS_API_KEY_SCOPE_NOT_DECLARED'
  const parts = [
    withoutScope.length > 0 ? `${withoutScope.length} call${withoutScope.length === 1 ? '' : 's'} declare${withoutScope.length === 1 ? 's' : ''} neither requiredScope nor allowAnyScope, so every API key is refused there with 403 SCOPE_NOT_DECLARED (${shown(withoutScope, describe)})` : null,
    undeclared.length > 0 ? `${undeclared.length} call${undeclared.length === 1 ? '' : 's'} require${undeclared.length === 1 ? 's' : ''} a scope that core and api.scopes do not declare (${shown(undeclared, describe)})` : null,
  ].filter(Boolean)
  return {
    name,
    status: 'warn',
    code,
    message: `${code}: ${parts.join('; ')}`,
    fix: first ? `${fixes.withoutScope.replace(/^pass/, 'Pass')}${undeclared.length > 0 ? `; then ${fixes.undeclared}` : ''}` : fixes.undeclared.replace(/^declare/, 'Declare'),
  }
}
