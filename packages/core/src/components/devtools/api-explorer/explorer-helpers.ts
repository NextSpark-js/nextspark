import type { HttpMethod, KeyValuePair } from '../api-tester/types'

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
