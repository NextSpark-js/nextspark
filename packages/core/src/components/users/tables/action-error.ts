type Translate = (key: string, values?: Record<string, number>) => string

/**
 * For a 429 of the superadmin users routes, how long to wait (Retry-After) in the catalog's words, where the route's
 * own text is "Rate limit exceeded" with no time; null for any other status. `t` reads `superadmin.users`.
 */
export function rateLimitedMessage(response: Response, t: Translate): string | null {
  if (response.status !== 429) return null
  const seconds = Number(response.headers.get('Retry-After'))
  return t('toast.rateLimited', { minutes: seconds > 0 ? Math.ceil(seconds / 60) : 1 })
}

/**
 * The toast text for a failed action of the users and superadmins tables: the wait of a 429; the catalog's text for a
 * refusal to remove the last superadmin; the fallback for a body that is not JSON (a proxy's error page) instead of a
 * JSON parse error; anything else keeps the route's `error`.
 */
export async function actionErrorMessage(response: Response, t: Translate, fallback: string): Promise<string> {
  const limited = rateLimitedMessage(response, t)
  if (limited) return limited
  const body = (await response.json().catch(() => null)) as { error?: unknown; code?: unknown } | null
  if (body?.code === 'LAST_SUPERADMIN') return t('toast.lastSuperadmin')
  return typeof body?.error === 'string' && body.error ? body.error : fallback
}
