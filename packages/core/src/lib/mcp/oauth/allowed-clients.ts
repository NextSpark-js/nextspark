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
 * Only a list that is absent or empty leaves the server open. A list that is there and names no usable host is a
 * mistake in a security setting, and it closes the server to every application instead of opening it to all:
 * `['https//claude.ai']` must not mean "anyone".
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

/** Reads `mcp.oauth.allowedClientHosts`: absent or an empty array is open; anything else is closed to all but its usable hosts. */
export function readAllowList(list: unknown): AllowList {
  if (list === undefined || list === null) return OPEN
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
 * The client a request to the token or the identity endpoint says it is from, read without verifying anything:
 * `client_id` in the body, the user of HTTP Basic, the subject of a signed client assertion, or the `azp` of a
 * bearer access token. Enough to refuse: the authorization server still authenticates that same client afterwards,
 * so naming an accepted client that one is not gains nothing. Undefined when the request names none.
 */
export function presentedClientId(request: { body?: unknown; authorization?: string | null }): string | undefined {
  const body = (request.body && typeof request.body === 'object' ? request.body : {}) as Record<string, unknown>
  if (typeof body.client_id === 'string' && body.client_id) return body.client_id
  if (typeof body.client_assertion === 'string') {
    const claims = decodeJwtPayload(body.client_assertion)
    const subject = claims?.sub ?? claims?.iss
    if (typeof subject === 'string' && subject) return subject
  }
  const [scheme, value] = (request.authorization ?? '').trim().split(/\s+/, 2)
  if (!value) return undefined
  if (/^basic$/i.test(scheme)) {
    try {
      const user = atob(value).split(':')[0]
      return user ? decodeURIComponent(user) : undefined
    } catch {
      return undefined
    }
  }
  if (/^(bearer|dpop)$/i.test(scheme)) {
    const claims = decodeJwtPayload(value)
    const client = claims?.azp ?? claims?.client_id
    return typeof client === 'string' && client ? client : undefined
  }
  return undefined
}
