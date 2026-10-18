/**
 * SMTP environment contract (SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER,
 * SMTP_PASS), kept free of nodemailer and process.env so the provider and the
 * auth readiness check judge the same variables the same way. Problems name
 * variables, never their values.
 */

export const SMTP_VARIABLES = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS'] as const

export type SmtpVariable = (typeof SMTP_VARIABLES)[number]

/** Raw values as read from the environment. */
export interface SmtpEnvironment {
  host?: string
  port?: string
  secure?: string
  user?: string
  pass?: string
}

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  /** Refuse to send in clear text: credentials are never offered to a remote host without STARTTLS. */
  requireTLS?: boolean
  auth?: { user: string; pass: string }
}

export interface SmtpProblem {
  variable: SmtpVariable
  state: 'missing' | 'malformed'
}

const HOST_PATTERN = /^[A-Za-z0-9._:-]+$/
const PORT_PATTERN = /^\d{1,5}$/

export function smtpEnvironmentFrom(env: Record<string, string | undefined>): SmtpEnvironment {
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  }
}

const isSet = (value: string | undefined): value is string => (value?.trim() ?? '') !== ''

function isValidPort(value: string): boolean {
  const port = Number(value)
  return PORT_PATTERN.test(value) && port >= 1 && port <= 65535
}

/**
 * Host is required; port is an integer from 1 to 65535 when set; secure is
 * exactly `true` or `false` when set; user and pass are set together or not
 * at all.
 */
export function findSmtpProblems(input: SmtpEnvironment): SmtpProblem[] {
  const problems: SmtpProblem[] = []
  const host = input.host?.trim() ?? ''
  if (!host) problems.push({ variable: 'SMTP_HOST', state: 'missing' })
  else if (!HOST_PATTERN.test(host)) problems.push({ variable: 'SMTP_HOST', state: 'malformed' })
  if (isSet(input.port) && !isValidPort(input.port.trim())) {
    problems.push({ variable: 'SMTP_PORT', state: 'malformed' })
  }
  if (isSet(input.secure) && !['true', 'false'].includes(input.secure.trim())) {
    problems.push({ variable: 'SMTP_SECURE', state: 'malformed' })
  }
  const hasUser = isSet(input.user)
  const hasPass = (input.pass ?? '') !== ''
  if (hasUser && !hasPass) problems.push({ variable: 'SMTP_PASS', state: 'missing' })
  if (hasPass && !hasUser) problems.push({ variable: 'SMTP_USER', state: 'missing' })
  return problems
}

/** localhost, 127.0.0.0/8 and ::1 (the only hosts where clear text does not cross a network). */
function isLoopback(host: string): boolean {
  return host === 'localhost' || host === '::1' || /^127(\.\d{1,3}){3}$/.test(host)
}

/**
 * Throws an error naming the offending variables when the configuration is
 * incomplete. An unset port is 465 when secure, otherwise 587. An unset
 * SMTP_SECURE means implicit TLS on port 465 and STARTTLS elsewhere (nodemailer's
 * own rule); with credentials, STARTTLS is required unless the host is loopback.
 */
export function parseSmtpConfig(input: SmtpEnvironment): SmtpConfig {
  const problems = findSmtpProblems(input)
  if (problems.length > 0) {
    throw new Error(
      `SMTP email provider is misconfigured: ${problems.map((p) => `${p.variable} is ${p.state}`).join('; ')}.`
    )
  }
  const port = isSet(input.port) ? Number(input.port.trim()) : undefined
  const secure = isSet(input.secure) ? input.secure.trim() === 'true' : port === 465
  const host = input.host!.trim()
  const config: SmtpConfig = { host, port: port ?? (secure ? 465 : 587), secure }
  if (isSet(input.user)) {
    config.auth = { user: input.user.trim(), pass: input.pass! }
    if (!secure && !isLoopback(host)) config.requireTLS = true
  }
  return config
}
