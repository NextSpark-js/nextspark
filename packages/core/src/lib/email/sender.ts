/**
 * The sender of every email provider (Resend, SMTP, console), shared by the
 * factory, the providers and auth readiness.
 *
 * EMAIL_FROM and EMAIL_FROM_NAME are the provider-neutral variables.
 * RESEND_FROM_EMAIL and RESEND_FROM_NAME, the names used before them, are read
 * only when the new one is unset; when both are set, EMAIL_FROM* wins. A value
 * that is empty or only whitespace counts as unset.
 */

export type SenderAddressVariable = 'EMAIL_FROM' | 'RESEND_FROM_EMAIL'

type SenderEnvironment = Record<string, string | undefined>

export interface EmailSender {
  /** The trimmed address; undefined when neither variable is set. */
  address?: string
  /** Where the address came from. EMAIL_FROM when neither is set: that is the variable to set. */
  addressVariable: SenderAddressVariable
  name?: string
  /** Each new variable set to a different value than its fallback, as `EMAIL_FROM and RESEND_FROM_EMAIL`. */
  conflicts: string[]
}

const PAIRS = [
  ['EMAIL_FROM', 'RESEND_FROM_EMAIL'],
  ['EMAIL_FROM_NAME', 'RESEND_FROM_NAME'],
] as const

const set = (value: string | undefined) => value?.trim() || undefined

/** Pure: reads only `env`, never logs. */
export function resolveEmailSender(env: SenderEnvironment): EmailSender {
  const address = set(env.EMAIL_FROM) ?? set(env.RESEND_FROM_EMAIL)
  return {
    address,
    addressVariable: !set(env.EMAIL_FROM) && address ? 'RESEND_FROM_EMAIL' : 'EMAIL_FROM',
    name: set(env.EMAIL_FROM_NAME) ?? set(env.RESEND_FROM_NAME),
    conflicts: PAIRS
      .filter(([preferred, fallback]) => set(env[preferred]) && set(env[fallback]) && set(env[preferred]) !== set(env[fallback]))
      .map(([preferred, fallback]) => `${preferred} and ${fallback}`),
  }
}

let conflictWarned = false

/**
 * The From header providers send with by default, `Name <address>` ('App'
 * when no name is set), or undefined without an address or `fallbackAddress`.
 * Warns once per process when old and new variables disagree, naming the
 * variables and never their values.
 */
export function defaultFromHeader(env: SenderEnvironment = process.env, fallbackAddress?: string): string | undefined {
  const sender = resolveEmailSender(env)
  if (sender.conflicts.length > 0 && !conflictWarned) {
    conflictWarned = true
    console.warn(`[email] ${sender.conflicts.join(', ')} are set to different values; the EMAIL_FROM variables win.`)
  }
  const address = sender.address ?? fallbackAddress
  return address ? `${sender.name || 'App'} <${address}>` : undefined
}

/** @internal Tests only: lets the next conflict warn again. */
export function resetSenderWarningForTests(): void {
  conflictWarned = false
}
