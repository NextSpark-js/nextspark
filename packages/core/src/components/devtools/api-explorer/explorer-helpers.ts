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
