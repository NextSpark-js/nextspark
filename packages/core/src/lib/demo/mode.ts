/**
 * Demo mode: a public, throwaway instance of a project with sample data. On only with NEXTSPARK_DEMO_MODE=true,
 * exactly, so no other value and no config file can turn it on.
 *
 * Without imports and client-safe (a browser sees no such variable, so it is always off there): the server is
 * what enforces the mode. `scripts/db/demo-reset.mjs` loads it from dist/.
 */

type Environment = Record<string, string | undefined>

export function isDemoMode(env?: Environment): boolean {
  // Written out when no env is passed, for bundlers that replace process.env.NAME
  return (env ? env.NEXTSPARK_DEMO_MODE : process.env.NEXTSPARK_DEMO_MODE) === 'true'
}

/** Names of the variables that would reach a real email, payment or storage service; values never matter. */
const REAL_SERVICE_VARIABLE = /^(RESEND_|SMTP_|S3_|BLOB_READ_WRITE_TOKEN$|(NEXT_PUBLIC_)?(STRIPE|POLAR|LEMONSQUEEZY|PADDLE)_\w*(KEY|TOKEN|SECRET)$)/

/** What stops this environment from running as a demo, naming variables and never their values. */
export function demoModeProblems(env: Environment): string[] {
  const problems = Object.keys(env).filter(name => REAL_SERVICE_VARIABLE.test(name) && env[name]?.trim()).sort().map(name => `${name} is set`)
  const email = env.EMAIL_PROVIDER?.trim()
  if (email && email !== 'console') problems.push('EMAIL_PROVIDER is not console')
  if (env.STORAGE_DRIVER?.trim().toLowerCase() !== 'local') problems.push('STORAGE_DRIVER is not local')
  if (!env.UPLOADS_DIR?.trim()) problems.push('UPLOADS_DIR is missing')
  return problems
}

/** The message that stops a demo from running, or null: outside demo mode, or with nothing to object to. */
export function demoModeRefusal(env: Environment): string | null {
  if (!isDemoMode(env)) return null
  const problems = demoModeProblems(env)
  return problems.length ? `NEXTSPARK_DEMO_MODE=true needs an environment without real services: ${problems.join('; ')}.` : null
}
