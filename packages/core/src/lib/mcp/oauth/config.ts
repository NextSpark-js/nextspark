/**
 * Switches and URLs of MCP browser sign-in (OAuth 2.1), #541.
 *
 * Off unless `MCP_OAUTH_ENABLED=true`, in every environment, and only counts while the MCP endpoint itself is on.
 * While it is off the authorization server is not registered (no plugin, no endpoint, no metadata, no database
 * access) and `/api/mcp` answers as it did before: API key only.
 */
import { withBasePath } from '../../base-path'
import { resolveBaseUrl } from '../../utils/base-url'

/** MCP kill switch: on in development unless 'false', off in production unless 'true'. */
export function isMcpEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = env.MCP_ENABLED
  if (env.NODE_ENV === 'production') return flag === 'true'
  return flag !== 'false'
}

export function isMcpOAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MCP_OAUTH_ENABLED === 'true' && isMcpEnabled(env)
}

const trimSlash = (url: string) => url.replace(/\/+$/, '')

/** The canonical MCP resource (RFC 8707 / RFC 9728): tokens are issued for it and it is the audience `/api/mcp` accepts. */
export function mcpResourceUrl(): string {
  return `${trimSlash(resolveBaseUrl())}${withBasePath('/api/mcp')}`
}

/** The authorization server's issuer: Better Auth's base URL with its path. */
export function mcpOAuthIssuer(): string {
  return `${trimSlash(resolveBaseUrl())}${withBasePath('/api/auth')}`
}

/** Identity scopes: part of sign-in, never an MCP permission. */
export const OIDC_SCOPES = ['openid', 'profile', 'email', 'offline_access'] as const

/** The access-token claim that carries the team the grant is bound to. */
export const TEAM_CLAIM = 'team_id'
