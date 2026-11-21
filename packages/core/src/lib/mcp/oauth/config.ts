/**
 * Switches and URLs of MCP browser sign-in (OAuth 2.1), #541.
 *
 * A project turns it on with `features: { mcpOAuth: true }` in nextspark.config.ts: `nextspark prepare` then
 * generates its routes (discovery documents, consent and team pages) and the build carries the flag. Without it the
 * host has none of those routes, the authorization server is not registered (no plugin, no endpoint, no metadata,
 * no database access) and `/api/mcp` answers as it did before: API key only.
 *
 * At runtime it only counts while the MCP endpoint itself is on, and `MCP_OAUTH_ENABLED=false` turns it off without
 * a build (the emergency switch).
 */
import { FEATURES } from '@nextsparkjs/registries/features'
import { withBasePath } from '../../base-path'
import { resolveBaseUrl } from '../../utils/base-url'

/** MCP kill switch: on in development unless 'false', off in production unless 'true'. */
export function isMcpEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = env.MCP_ENABLED
  if (env.NODE_ENV === 'production') return flag === 'true'
  return flag !== 'false'
}

/** The project was built with MCP browser sign-in (`features.mcpOAuth`). Client-safe. */
export function isMcpOAuthBuilt(): boolean {
  return FEATURES.mcpOAuth === true
}

export function isMcpOAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isMcpOAuthBuilt() && env.MCP_OAUTH_ENABLED !== 'false' && isMcpEnabled(env)
}

const trimSlash = (url: string) => url.replace(/\/+$/, '')

/** The canonical MCP resource (RFC 8707 / RFC 9728): tokens are issued for it and it is the audience `/api/mcp` accepts. */
export function mcpResourceUrl(): string {
  return `${trimSlash(resolveBaseUrl())}${withBasePath('/api/mcp')}`
}

const WELL_KNOWN = /^\/\.well-known\/(oauth-protected-resource|oauth-authorization-server|openid-configuration)(\/.*)?$/

/**
 * Where the resource's RFC 9728 metadata is served, which the 401 challenge of `/api/mcp` names.
 *
 * Without a Next.js basePath it is the RFC's own location: the well-known path at the origin, suffixed with the
 * resource's path. An app under a basePath owns no URL outside it, so it serves the document inside
 * (`/base/.well-known/oauth-protected-resource/api/mcp`) and the challenge points there; a client follows the
 * challenge, it does not guess the location.
 */
export function mcpResourceMetadataUrl(): string {
  return `${new URL(mcpResourceUrl()).origin}${withBasePath('/.well-known/oauth-protected-resource/api/mcp')}`
}

/**
 * The path Better Auth answers for a discovery request the app received at `pathname` (without the basePath, as
 * Next.js hands it to a route). The plugins match the RFC locations, where the suffix is the full path of the
 * resource or issuer, basePath included: `/.well-known/<document>/api/mcp` is `/.well-known/<document>/base/api/mcp`
 * to them. Unchanged without a basePath, and for the root document (no suffix).
 */
export function oauthDiscoveryPath(pathname: string): string {
  const match = WELL_KNOWN.exec(pathname)
  if (!match || !match[2]) return pathname
  return `/.well-known/${match[1]}${withBasePath(match[2])}`
}

/** The authorization server's issuer: Better Auth's base URL with its path. */
export function mcpOAuthIssuer(): string {
  return `${trimSlash(resolveBaseUrl())}${withBasePath('/api/auth')}`
}

/** Identity scopes: part of sign-in, never an MCP permission. */
export const OIDC_SCOPES = ['openid', 'profile', 'email', 'offline_access'] as const

/** The access-token claim that carries the team the grant is bound to. */
export const TEAM_CLAIM = 'team_id'

/** The access-token claim that carries the newest revocation the token was issued after (see lib/mcp/oauth/revocation). */
export const REVOCATION_CLAIM = 'rev'
