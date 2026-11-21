import type { AuthType, HttpMethod, KeyValuePair } from '../api-tester/types'
import type { ApiPreset } from '../../../types/api-presets'
import { createPresetPlaceholderValues, resolvePresetPlaceholders } from './preset-placeholders'

/**
 * Where an endpoint lives in the sidebar: the group is its first path segment and `shortPath` the rest.
 * Core and entity routes sit under `/api/v1/`; a project's own routes sit under `/api/`, so both bases are
 * stripped (leaving the base on a theme route made every one of them a "root" entry shown as `//api/...`).
 */
export function splitRoutePath(path: string): { group: string; shortPath: string } {
  const [group = '', ...rest] = path.replace(/^\/api\/(?:v1\/)?(?:plugins\/)?/, '').replace(/^\/+/, '').split('/')
  return { group: group || 'root', shortPath: rest.join('/') }
}

/** The method an endpoint opens with: `GET`, else the first method that is not a preflight (OPTIONS/HEAD). */
export function defaultMethod(methods: readonly string[]): HttpMethod {
  const pick = methods.includes('GET') ? 'GET' : methods.find((m) => m !== 'OPTIONS' && m !== 'HEAD') ?? methods[0]
  return (pick ?? 'GET') as HttpMethod
}

/** Rows that carry a key: the editors keep blank rows to type into, which are not params or headers. */
export function countFilledRows(rows: readonly KeyValuePair[]): number {
  return rows.filter((row) => row.key.trim() !== '').length
}

/**
 * The team a request opens with when none has been chosen: the team the dashboard last had active when the
 * user belongs to it, else the only team they have. With several teams and no active one there is no honest
 * default, so it stays unset and the choice is theirs. A team that is already set is never replaced.
 */
export function pickDefaultTeamId(
  teams: readonly { id: string }[],
  current: string | null,
  activeTeamId: string | null
): string | null {
  if (current) return current
  if (activeTeamId && teams.some((team) => team.id === activeTeamId)) return activeTeamId
  return teams.length === 1 ? teams[0].id : null
}

/** A row of `GET /api/superadmin/users`, the fields the act-as picker reads. */
export interface SuperadminUserRow {
  id: string
  email: string
  fullName?: string
  firstName?: string
  lastName?: string
  role?: string
}

/** A user a request can be made as. `label` is what the chip and the trigger show: the email, which is unique. */
export interface ActAsUser {
  id: string
  label: string
  name: string
  role: string
}

export function toActAsUser(row: SuperadminUserRow): ActAsUser {
  const name = [row.firstName, row.lastName].filter(Boolean).join(' ').trim()
  return { id: row.id, label: row.email, name: name === row.email ? '' : name, role: row.role ?? '' }
}

/** How a request was made, captured when it was sent so the response says what was used, not what is set now. */
export interface RequestContext {
  auth: AuthType
  /** The team's name (or its id when the name is not known); null when no team was sent. */
  team: string | null
  crossTeam: boolean
  /** The email (or id) of the user the request was made as; null for the caller's own identity. */
  actingAs: string | null
}

/** The methods that send a body. */
export const BODY_METHODS: readonly string[] = ['POST', 'PATCH', 'PUT']

interface SkeletonField {
  name: string
  type: string
  required: boolean
  defaultValue?: unknown
  options?: readonly { value: string | number }[]
  api?: { readOnly?: boolean }
}

/**
 * The JSON a create request needs at least: every required, writable field with its default, or an empty value
 * of its type. null when no field is required, so the editor stays empty rather than showing `{}`.
 */
export function bodySkeleton(fields: readonly SkeletonField[]): Record<string, unknown> | null {
  const body: Record<string, unknown> = {}
  for (const field of fields) {
    if (!field.required || field.api?.readOnly) continue
    if (field.defaultValue !== undefined) body[field.name] = field.defaultValue
    else if (['number', 'range', 'rating'].includes(field.type)) body[field.name] = 0
    else if (field.type === 'boolean') body[field.name] = false
    else if (field.type === 'json') body[field.name] = {}
    else if (['multiselect', 'tags', 'relation-multi'].includes(field.type)) body[field.name] = []
    else if (['select', 'radio', 'buttongroup', 'combobox'].includes(field.type)) body[field.name] = field.options?.[0]?.value ?? ''
    else body[field.name] = ''
  }
  return Object.keys(body).length ? body : null
}

/**
 * What the Body tab opens with when nothing has been typed: the payload of the endpoint's first preset for the
 * method (placeholders resolved, as when a preset is applied), else the skeleton of the required fields for a
 * POST, else nothing.
 */
export function initialBody(
  method: string,
  presets: readonly ApiPreset[] | undefined,
  skeleton: Record<string, unknown> | undefined | null
): string {
  if (!BODY_METHODS.includes(method)) return ''
  const preset = presets?.find((p) => p.method === method && p.payload && Object.keys(p.payload).length > 0)
  if (preset?.payload) return JSON.stringify(resolvePresetPlaceholders(preset.payload, createPresetPlaceholderValues()), null, 2)
  if (method === 'POST' && skeleton) return JSON.stringify(skeleton, null, 2)
  return ''
}

/** The sidebar group key (`category:group`) an endpoint lives in, so the group of the selected endpoint can open. */
export function groupKeyForPath(routes: Record<string, readonly { path: string }[]>, path: string): string | null {
  for (const [category, entries] of Object.entries(routes)) {
    if (entries.some((entry) => entry.path === path)) return `${category}:${splitRoutePath(path).group}`
  }
  return null
}

/** Blank key-value rows for the params and headers editors: one to type into, "Add" makes more. */
export function createEmptyRows(count = 1): KeyValuePair[] {
  return Array.from({ length: count }, () => ({ id: crypto.randomUUID(), key: '', value: '', enabled: true }))
}

/**
 * The headers the Explorer adds itself: the cross-team bypass, the team, and the act-as override; the headers the user
 * typed come last and win. The one place that decides them, so a request and its "Copy as cURL" cannot disagree.
 */
export function buildRequestHeaders(input: {
  bypassMode: boolean
  selectedTeamId: string | null
  actAsUserId: string
  headers: readonly KeyValuePair[]
}): Record<string, string> {
  const headers: Record<string, string> = {}
  if (input.bypassMode) headers['x-admin-bypass'] = 'confirm-cross-team-access'
  if (input.selectedTeamId) headers['x-team-id'] = input.selectedTeamId
  if (input.actAsUserId.trim()) headers['x-act-as-user'] = input.actAsUserId.trim()
  for (const row of input.headers) {
    if (row.enabled && row.key) headers[row.key] = row.value
  }
  return headers
}

/** `sk_live_abcdef123456` -> `sk_l••••3456`: enough to tell which key it was, not enough to use it. */
export function maskApiKey(key: string): string {
  return key.length > 8 ? `${key.slice(0, 4)}••••${key.slice(-4)}` : '••••'
}

const shellQuote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`

/** Headers whose value is a credential, by lower-case name: they are masked in a copied cURL whoever typed them. */
const SENSITIVE_HEADERS = ['authorization', 'proxy-authorization', 'cookie', 'x-api-key']

/** `Bearer abc123456789` -> `Bearer abc1••••6789`; a cookie masks each value and keeps the names. */
function maskHeaderValue(name: string, value: string): string {
  const lower = name.toLowerCase()
  if (lower === 'cookie') return value.split(';').map((pair) => {
    const [key, ...rest] = pair.split('=')
    return rest.length ? `${key}=${maskApiKey(rest.join('=').trim())}` : pair
  }).join(';')
  if (lower === 'authorization' || lower === 'proxy-authorization') {
    const scheme = /^(\S+)\s+(.+)$/.exec(value)
    return scheme ? `${scheme[1]} ${maskApiKey(scheme[2])}` : maskApiKey(value)
  }
  return maskApiKey(value)
}

/**
 * The request as a cURL command. Every credential header is masked by name, whatever its case and whether the Explorer
 * added it or the user typed it (Authorization, Proxy-Authorization, Cookie, x-api-key), and a header appears once.
 * A session request carries a Cookie placeholder unless a cookie was typed: a cURL has no browser session, so the user
 * pastes theirs (or their real key), which is the point of copying it masked.
 */
export function buildCurl(input: {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
  authType: AuthType
  apiKey?: string
}): string {
  // one entry per header name, case-insensitive; a later one replaces an earlier one, name and value, and keeps its place
  const entries = new Map<string, [string, string]>()
  const put = (name: string, value: string) => {
    const key = name.toLowerCase()
    entries.set(key, [name, value])
  }
  put('Content-Type', 'application/json')
  for (const [name, value] of Object.entries(input.headers)) put(name, value)
  if (input.authType === 'apiKey' && input.apiKey) put('x-api-key', input.apiKey)
  if (input.authType === 'session' && !entries.has('cookie')) put('Cookie', '<your-session-cookie>')

  const lines = [`curl -X ${input.method} ${shellQuote(input.url)}`]
  for (const [key, [name, value]] of entries) {
    const shown = SENSITIVE_HEADERS.includes(key) && !(key === 'cookie' && value === '<your-session-cookie>') ? maskHeaderValue(name, value) : value
    lines.push(`  -H ${shellQuote(`${name}: ${shown}`)}`)
  }
  if (BODY_METHODS.includes(input.method) && input.body?.trim()) lines.push(`  -d ${shellQuote(input.body)}`)
  return lines.join(' \\\n')
}

/** The enabled, filled query rows as a `?a=1&b=2` string ('' when there are none), the form the URL carries. */
export function queryToSearch(rows: readonly KeyValuePair[]): string {
  const params = new URLSearchParams()
  for (const row of rows) {
    if (row.enabled && row.key && row.value) params.append(row.key, row.value)
  }
  const search = params.toString()
  return search ? `?${search}` : ''
}

/** The rows a `?a=1&b=2` string stands for; empty when it has none, so the caller can fall back to its own. */
export function searchToRows(search: string): KeyValuePair[] {
  return Array.from(new URLSearchParams(search).entries()).map(([key, value]) => ({
    id: crypto.randomUUID(),
    key,
    value,
    enabled: true,
  }))
}

/** A request sent from the Explorer, kept in the "Recent" list. */
export interface RecentRequest {
  method: string
  path: string
  pathParams: Record<string, string>
  query: { key: string; value: string }[]
  body: string
  /** The HTTP status, or null when the request failed before getting one. */
  status: number | null
  at: number
}

export const RECENT_LIMIT = 20

const sameRequest = (a: RecentRequest, b: RecentRequest) =>
  a.method === b.method &&
  a.path === b.path &&
  JSON.stringify(a.pathParams) === JSON.stringify(b.pathParams) &&
  JSON.stringify(a.query) === JSON.stringify(b.query)

/** The list with `entry` at the top: a request repeated moves up (with its new status) instead of being listed twice. */
export function pushRecent(list: readonly RecentRequest[], entry: RecentRequest, limit = RECENT_LIMIT): RecentRequest[] {
  return [entry, ...list.filter((item) => !sameRequest(item, entry))].slice(0, limit)
}
