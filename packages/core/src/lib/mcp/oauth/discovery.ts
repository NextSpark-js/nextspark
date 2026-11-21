/**
 * OAuth discovery documents served at the root of the app (#541): RFC 9728 protected resource metadata and RFC 8414
 * authorization server metadata. They live outside `/api/auth`, so the auth route never sees them; the plugins answer
 * them when the request reaches Better Auth's handler. 404 while MCP_OAUTH_ENABLED is off.
 */
import { auth } from '../../auth'
import { isMcpOAuthEnabled } from './config'

// Public documents: any client, a browser-based one included, may read them
const PUBLIC_CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS' }

export async function serveOAuthDiscovery(request: Request): Promise<Response> {
  if (!isMcpOAuthEnabled()) return new Response('Not found', { status: 404 })
  // Spike limit: an app under a Next.js basePath cannot serve these, RFC 8414 and RFC 9728 put them at the origin's
  // root, outside the base path. Such a deployment has to route the two well-known paths to the app at its proxy.
  const response = await auth.handler(request)
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(PUBLIC_CORS)) headers.set(name, value)
  return new Response(response.body, { status: response.status, headers })
}

export function discoveryPreflight(): Response {
  return isMcpOAuthEnabled()
    ? new Response(null, { status: 204, headers: { ...PUBLIC_CORS, 'Access-Control-Allow-Headers': '*' } })
    : new Response('Not found', { status: 404 })
}
