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
 * metadata document is even fetched, and on every request made with a token it was issued before the list changed.
 * Without a list, or with an empty one, nothing changes.
 *
 * No imports of the server: the rule is a function of a client id and a list.
 */

/** A host as it is compared: lower case, no surrounding space, no trailing dot. */
const normalize = (host: string) => host.trim().toLowerCase().replace(/\.$/, '')

/** The hosts of the list that can be used: strings that name a host, with or without `*.` in front. */
export function usableHosts(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  return list.filter((entry): entry is string => typeof entry === 'string').map(normalize).filter(host => /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(host))
}

/**
 * Whether the application with this client id may connect under `list`. No usable entry: every application may.
 * Otherwise only a client id that is an https URL whose host is on the list.
 */
export function isClientAllowed(clientId: string | null | undefined, list: unknown): boolean {
  const hosts = usableHosts(list)
  if (!hosts.length) return true
  if (!clientId) return false
  let url: URL
  try {
    url = new URL(clientId)
  } catch {
    return false // an id that is not a URL names no host
  }
  if (url.protocol !== 'https:') return false
  const host = normalize(url.hostname)
  return hosts.some(allowed => (allowed.startsWith('*.') ? host.endsWith(allowed.slice(1)) : host === allowed))
}
