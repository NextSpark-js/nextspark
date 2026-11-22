/**
 * Which applications may connect by MCP browser sign-in (#541). By default any application that publishes a valid
 * Client ID Metadata Document can start a sign-in, and the user decides on the consent screen, which names the
 * application and its host. A project that wants to decide itself lists the hosts it accepts in
 * `mcp.oauth.allowedClientHosts` of config/app.config.ts:
 *
 *   mcp: { oauth: { allowedClientHosts: ['claude.ai', 'chatgpt.com'] } }
 *
 * With a list, an application is accepted only when its client id is an https URL on one of those hosts (`*.` in
 * front of a host accepts its subdomains too). Anything else is refused: when it asks for authorization, before its
 * metadata document is even fetched, when it exchanges a code or renews a token, when it reads the user's identity
 * and on every request to the MCP endpoint, so a token issued before the list changed counts no more.
 *
 * Only a list that is absent (undefined) or empty leaves the server open. Anything else that names no usable host,
 * `null` included, is a mistake in a security setting, and it closes the server to every application instead of
 * opening it to all: `['https//claude.ai']` must not mean "anyone".
 *
 * No imports: the rule is a function of a client id and a list.
 */

/** What a project's list comes to: `open` to every application, or closed to all but `hosts`. `unusable`: entries that name no host. */
export interface AllowList {
  open: boolean
  hosts: string[]
  unusable: string[]
}

const OPEN: AllowList = { open: true, hosts: [], unusable: [] }

/**
 * An entry as the host it names, or null: `claude.ai`, `*.example.com`, and for whoever pasted a URL,
 * `https://claude.ai` or `claude.ai/`. An international name is compared in its ASCII form, as a URL carries it.
 */
function hostOfEntry(entry: unknown): string | null {
  if (typeof entry !== 'string') return null
  let text = entry.trim().toLowerCase().replace(/^https:\/\//, '').replace(/\/$/, '')
  const wildcard = text.startsWith('*.')
  if (wildcard) text = text.slice(2)
  // what is left is a bare host: no path, port, credentials, query or space
  if (!text || /[\/:@?#\s*]/.test(text)) return null
  let host: string
  try {
    host = new URL(`https://${text}`).hostname.replace(/\.$/, '')
  } catch {
    return null
  }
  if (!host || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(host)) return null
  return wildcard ? `*.${host}` : host
}

/** Reads `mcp.oauth.allowedClientHosts`: undefined or an empty array is open; anything else is closed to all but its usable hosts. */
export function readAllowList(list: unknown): AllowList {
  if (list === undefined) return OPEN
  if (!Array.isArray(list)) return { open: false, hosts: [], unusable: [String(list)] }
  if (list.length === 0) return OPEN
  const hosts: string[] = []
  const unusable: string[] = []
  for (const entry of list) {
    const host = hostOfEntry(entry)
    if (host) hosts.push(host)
    else unusable.push(String(entry))
  }
  return { open: false, hosts: [...new Set(hosts)], unusable }
}

/**
 * Whether the application with this client id may connect under `list`. Open (no list): every application may.
 * Otherwise only a client id that is an https URL, with no credentials in it, whose host is on the list.
 */
export function isClientAllowed(clientId: string | null | undefined, list: unknown): boolean {
  const allowList = readAllowList(list)
  if (allowList.open) return true
  if (!clientId) return false
  let url: URL
  try {
    url = new URL(clientId)
  } catch {
    return false // an id that is not a URL names no host
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  return allowList.hosts.some(allowed => (allowed.startsWith('*.') ? host.endsWith(allowed.slice(1)) : host === allowed))
}

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const payload = token.split('.')[1]
    return payload ? (JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * Every client a request to the token or the identity endpoint names, read without verifying anything: `client_id`
 * in the body, the subject of a signed client assertion, the user of HTTP Basic, and the `azp` of an access token
 * sent in the body (`access_token`) or as a bearer. All of them and not the first: a request can carry more than
 * one, and which one the authorization server then goes by is its own business. A request is let through only when
 * every client it names is accepted (isRequestAllowed), so naming an accepted one beside the real one gains
 * nothing. Empty when the request names none that can be read, an opaque access token included.
 */
export function presentedClientIds(request: { body?: unknown; authorization?: string | null }): string[] {
  const body = (request.body && typeof request.body === 'object' ? request.body : {}) as Record<string, unknown>
  const named: string[] = []
  const add = (value: unknown) => {
    if (typeof value === 'string' && value) named.push(value)
  }
  const azpOf = (token: unknown) => {
    const claims = typeof token === 'string' ? decodeJwtPayload(token) : null
    add(claims?.azp ?? claims?.client_id)
  }
  add(body.client_id)
  if (typeof body.client_assertion === 'string') {
    const claims = decodeJwtPayload(body.client_assertion)
    add(claims?.sub)
    add(claims?.iss)
  }
  // RFC 6750 section 2.2: the access token as a form field
  azpOf(body.access_token)
  const [scheme, value] = (request.authorization ?? '').trim().split(/\s+/, 2)
  if (value && /^basic$/i.test(scheme)) {
    try {
      const user = atob(value).split(':')[0]
      add(user ? decodeURIComponent(user) : undefined)
    } catch {
      // not Basic credentials: nothing named
    }
  }
  if (value && /^(bearer|dpop)$/i.test(scheme)) azpOf(value)
  return [...new Set(named)]
}

/**
 * Whether a request to the token or the identity endpoint may go on under `list`. No list: it may. With a list: it
 * names at least one client that can be read, and every client it names is accepted.
 */
export function isRequestAllowed(request: { body?: unknown; authorization?: string | null }, list: unknown): boolean {
  if (readAllowList(list).open) return true
  const named = presentedClientIds(request)
  return named.length > 0 && named.every(clientId => isClientAllowed(clientId, list))
}
