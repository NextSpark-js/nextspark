/**
 * OAuth discovery documents served at the root of the app (#541): RFC 9728 protected resource metadata and RFC 8414
 * authorization server metadata. They live outside `/api/auth`, so the auth route never sees them; the plugins answer
 * them when the request reaches Better Auth's handler. 404 while MCP browser sign-in is off.
 *
 * An app under a Next.js basePath serves them inside it: the 401 challenge of `/api/mcp` names the resource document
 * there, and a client finds the authorization server's at `<issuer>/.well-known/openid-configuration` (or
 * `<issuer>/.well-known/oauth-authorization-server`), which the auth route answers. The RFC locations at the origin's root are outside what such an app can serve.
 */
import { auth } from '../../auth'
import { isMcpOAuthEnabled, oauthDiscoveryPath } from './config'

// Public documents: any client, a browser-based one included, may read them
const PUBLIC_CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS' }

export async function serveOAuthDiscovery(request: Request): Promise<Response> {
  if (!isMcpOAuthEnabled()) return new Response('Not found', { status: 404 })
  // Under a Next.js basePath the documents are served inside it and asked of Better Auth at the RFC location
  const url = new URL(request.url)
  url.pathname = oauthDiscoveryPath(url.pathname)
  const response = await auth.handler(new Request(url, request))
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(PUBLIC_CORS)) headers.set(name, value)
  return new Response(response.body, { status: response.status, headers })
}

export function discoveryPreflight(): Response {
  return isMcpOAuthEnabled()
    ? new Response(null, { status: 204, headers: { ...PUBLIC_CORS, 'Access-Control-Allow-Headers': '*' } })
    : new Response('Not found', { status: 404 })
}
