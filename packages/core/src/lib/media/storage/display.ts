import { selectStorageDriver } from './index'

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
