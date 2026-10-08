/**
 * The password hashes the sample data ships with (core's 090_sample_data.sql and
 * the project templates' sample data). A "credential" account that still holds
 * one of them can be signed in to with a documented password.
 * Keep in sync with migrations/029_sample_accounts_outside_development.sql.
 */
export const SAMPLE_PASSWORD_HASHES = [
  '22de14d5472248ed0bece911df908b2a:d29576424798ba6845d348a3767c0b0f38a00f2aca461b3b1d34b99a93cab06c86774c6edb183e6d6ec47457649b032a49a7b60a48f6f4f7fbbc4ea40258f19f',
  '3db9e98e2b4d3caca97fdf2783791cbc:34b293de615caf277a237773208858e960ea8aa10f1f5c5c309b632f192cac34d52ceafbd338385616f4929e4b1b6c055b67429c6722ffdb80b01d9bf4764866',
] as const

type QueryRows = (text: string, params?: unknown[]) => Promise<Array<{ count: number }>>

/**
 * In production, logs one warning when accounts with a sample password exist.
 * Never throws. When the query fails it logs one line with the error code or class name only
 * (never the error object, which can carry the connection string).
 */
export async function warnSampleAccountsAtStartup(
  env: Record<string, string | undefined> = process.env,
  queryRows?: QueryRows,
): Promise<void> {
  if (env.NODE_ENV !== 'production') return
  try {
    const run = queryRows ?? (await import('../db')).queryRows as QueryRows
    const [row] = await run(
      `SELECT count(*)::int AS count FROM "account" WHERE "providerId" = 'credential' AND "password" = ANY($1)`,
      [SAMPLE_PASSWORD_HASHES],
    )
    if (row && row.count > 0) {
      console.warn(`[auth-readiness] ${row.count} account(s) still have a sample-data password; pnpm db:migrate disables them once; if it already ran, see the CHANGELOG upgrade notes`)
    }
  } catch (error) {
    const safe = (value: unknown) => (typeof value === 'string' && /^[A-Za-z0-9_]{1,40}$/.test(value) ? value : undefined)
    const reason = safe((error as { code?: unknown } | null)?.code) ?? safe((error as Error | null)?.name) ?? 'unknown error'
    console.warn(`[auth-readiness] could not check for sample-data passwords at startup (query failed: ${reason}); check DATABASE_URL, then run the read-only query in the 0.1.0-beta.196 CHANGELOG upgrade notes`)
  }
}
