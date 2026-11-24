/**
 * Switches and URLs of MCP browser sign-in (OAuth 2.1), #541.
 *
 * A project turns it on with `features: { mcpOAuth: true }` in nextspark.config.ts: `nextspark prepare` then
 * generates its routes (discovery documents, consent and team pages) and the build carries the flag. Without it the
 * host has none of those routes, the authorization server is not registered (no plugin, no endpoint, no metadata,
 * no database access) and `/api/mcp` answers as it did before: API key only.
 *
 * At runtime it only counts while the MCP endpoint itself is on, and `MCP_OAUTH_ENABLED=false` turns it off without
 * a build (the emergency switch). In production it also has a gate: it does not start without Redis, and serves no
 * OAuth request while the database role skips row-level security, unless `MCP_OAUTH_ACCEPT_RISKS` names what the
 * deployment accepts (./production-risks, ./production-gate).
 */
import { withBasePath } from '../../base-path'
import { APP_CONFIG_MERGED } from '../../config/config-client'
import { readAllowList } from './allowed-clients'
import { resolveAppUrl, resolveBaseUrl } from '../../utils/base-url'
import { isMcpOAuthBuilt } from './built'
import { sharedRateLimitGate } from './production-risks'

// Client code takes it from './built': this module reads the app configuration, which no public page should load
export { isMcpOAuthBuilt }

/** MCP kill switch: on in development unless 'false', off in production unless 'true'. */
export function isMcpEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = env.MCP_ENABLED
  if (env.NODE_ENV === 'production') return flag === 'true'
  return flag !== 'false'
}

/**
 * Whether MCP browser sign-in is on: built, not switched off, with the MCP endpoint on, and, in production, let
 * through by the half of the production gate the environment decides (./production-risks: Redis, or the missing
 * shared rate limit accepted by name). The other half, the role of the database, is asked on each OAuth request
 * (./production-gate).
 */
export function isMcpOAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isMcpOAuthBuilt() && env.MCP_OAUTH_ENABLED !== 'false' && isMcpEnabled(env) && sharedRateLimitGate(env)
}

let warnedAbout: string | undefined

/**
 * `mcp.oauth.allowedClientHosts` of app.config, read on each call; undefined when the project sets none. An entry
 * that names no host is said once, loudly: the list still closes the server to everything it does not name.
 */
export function allowedClientHosts(): unknown {
  const list = (APP_CONFIG_MERGED as { mcp?: { oauth?: { allowedClientHosts?: unknown } } } | undefined)?.mcp?.oauth?.allowedClientHosts
  const read = readAllowList(list)
  if (!read.open && read.unusable.length) {
    const about = read.unusable.join(', ')
    if (warnedAbout !== about) {
      warnedAbout = about
      console.error(
        `[mcp:oauth] mcp.oauth.allowedClientHosts has entries that name no host and are ignored: ${about}. ` +
          (read.hosts.length ? `Only ${read.hosts.join(', ')} may connect.` : 'No entry is usable, so NO application may connect.') +
          " Write hosts such as 'claude.ai' or '*.example.com'."
      )
    }
  }
  return list
}

const trimSlash = (url: string) => url.replace(/\/+$/, '')

/**
 * The canonical MCP resource (RFC 8707 / RFC 9728): tokens are issued for it and it is the audience `/api/mcp`
 * accepts. It is a URL of the app (`NEXT_PUBLIC_APP_URL`), not of the auth server: BETTER_AUTH_URL may name another
 * origin or carry a path of its own.
 */
export function mcpResourceUrl(): string {
  return `${new URL(resolveAppUrl()).origin}${withBasePath('/api/mcp')}`
}

const WELL_KNOWN = /^\/\.well-known\/(oauth-protected-resource|oauth-authorization-server)(\/.*)?$/

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
 * resource (for its metadata) or of the issuer (for the authorization server's): the app serves the documents at
 * `/.well-known/oauth-protected-resource/api/mcp` and `/.well-known/oauth-authorization-server/api/auth`, and asks
 * for them with the resource's and the issuer's real paths, whatever basePath or BETTER_AUTH_URL path they carry.
 * Unchanged for the root document (no suffix) and for any other path.
 */
export function oauthDiscoveryPath(pathname: string): string {
  const match = WELL_KNOWN.exec(pathname)
  if (!match || !match[2]) return pathname
  if (match[1] === 'oauth-protected-resource') {
    return match[2] === '/api/mcp' ? `/.well-known/oauth-protected-resource${new URL(mcpResourceUrl()).pathname}` : pathname
  }
  return match[2] === '/api/auth' ? `/.well-known/oauth-authorization-server${new URL(mcpOAuthIssuer()).pathname}` : pathname
}

/**
 * The authorization server's issuer: the URL Better Auth serves its routes under. A BETTER_AUTH_URL that already
 * has a path is that URL as it is (Better Auth then ignores its `basePath` option, see lib/auth.ts); otherwise it
 * is the origin with the app's base path and `/api/auth`.
 */
export function mcpOAuthIssuer(): string {
  const base = new URL(resolveBaseUrl())
  const ownPath = trimSlash(base.pathname)
  return ownPath ? `${base.origin}${ownPath}` : `${base.origin}${withBasePath('/api/auth')}`
}

/** Identity scopes: part of sign-in, never an MCP permission. */
export const OIDC_SCOPES = ['openid', 'profile', 'email', 'offline_access'] as const

/** The access-token claim that carries the team the grant is bound to. */
export const TEAM_CLAIM = 'team_id'

/** The access-token claim that carries the newest revocation the token was issued after (see lib/mcp/oauth/revocation). */
export const REVOCATION_CLAIM = 'rev'
