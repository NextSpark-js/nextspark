import { selectStorageDriver } from './index'
import { MediaService } from '../../services/media.service'
import { collectHttpUrls, replaceUrls } from '../deep-urls'

/** Whether the selected driver keeps a private bucket, so stored URLs need signing to be shown. */
export function privateReadsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!selectStorageDriver(env).driver?.privateReads
}

/**
 * Signed read URLs for stored URLs that live outside a media row (an entity field, a block image), keyed by
 * the stored URL. A URL is answered only when it is an object of this bucket and environment AND an active file
 * of `teamId`: a URL of another origin, another environment or another team is left out, with no sign of which.
 * `userId` runs the lookup under that user's RLS context; null is a public page. Empty when the mode is off.
 * Never stored, never logged.
 */
export async function signTeamUrls(urls: string[], teamId: string, userId: string | null, env: NodeJS.ProcessEnv = process.env): Promise<Record<string, string>> {
  const driver = selectStorageDriver(env).driver
  if (!driver?.privateReads || !driver.signedReadUrl) return {}
  const signed: Record<string, string> = {}
  // Signing is local arithmetic, so the bucket check comes first and only own objects reach the database
  for (const url of new Set(urls)) {
    const value = await driver.signedReadUrl(url).catch(() => null)
    if (value) signed[url] = value
  }
  const candidates = Object.keys(signed)
  if (candidates.length === 0) return {}
  const allowed = await MediaService.teamUrls(candidates, teamId, userId)
  return Object.fromEntries(candidates.filter(url => allowed.has(url)).map(url => [url, signed[url]]))
}

/**
 * A public page's block props with every own-bucket URL of the page's team replaced by its signed one (a string
 * prop, or the `url` of a `{ mediaId, url }` reference, at any depth). Everything else is returned as it is, and
 * with the mode off the same value comes back untouched. Call it where the page is rendered, never before storing.
 */
export async function signBlocksMedia<T>(value: T, teamId: string, env: NodeJS.ProcessEnv = process.env): Promise<T> {
  if (!privateReadsEnabled(env)) return value
  const found = collectHttpUrls(value)
  if (found.size === 0) return value
  return replaceUrls(value, await signTeamUrls([...found], teamId, null, env))
}

/**
 * Adds `displayUrl` to media rows when the selected driver keeps a private bucket: `url` stays the
 * canonical, unsigned address (what entity fields and blocks store and what delete matches), and
 * `displayUrl` is the short-lived signed one to put in an `src`. Without a private driver the rows
 * come back as they are. A signing failure leaves a row without `displayUrl`; nothing is logged with it.
 */
export async function withDisplayUrls<T extends { url: string }>(rows: T[], env: NodeJS.ProcessEnv = process.env): Promise<(T & { displayUrl?: string })[]> {
  const selection = selectStorageDriver(env)
  const driver = selection.driver
  if (!driver?.signedReadUrl) return rows
  return Promise.all(rows.map(async (row) => {
    const displayUrl = await driver.signedReadUrl!(row.url).catch(() => null)
    return displayUrl ? { ...row, displayUrl } : row
  }))
}

/**
 * One stored URL (an entity field, a block image) ready to render: signed when it is an object of the
 * private bucket, the same string otherwise. Call it where the page or response is built, never before storing.
 */
export async function signStoredMediaUrl(url: string, env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const driver = selectStorageDriver(env).driver
  return (await driver?.signedReadUrl?.(url).catch(() => null)) ?? url
}
