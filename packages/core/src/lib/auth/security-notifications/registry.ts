/**
 * Template registry for security emails.
 *
 * Resolution order for a given (type, locale):
 *   1. a theme-registered builder for the exact `type:locale`
 *   2. a theme-registered builder for the language-only `type:<lang>` (e.g. es-AR → es)
 *   3. a theme-registered builder for `type:*` (locale-agnostic override)
 *   4. the core baseline builder for that type (locale-aware ES/EN copy)
 *
 * The registry lives on globalThis so it survives Next.js HMR module reloads in
 * dev — same pattern as the scheduled-actions registry.
 */

import type {
  SecurityEventType,
  SecurityEmailTemplateBuilder,
} from './types'
import newDeviceLogin from './templates/new-device-login'
import passwordChanged from './templates/password-changed'
import emailChanged from './templates/email-changed'

/** Core baseline builders — the always-present fallback for every event type. */
const BASELINE: Record<SecurityEventType, SecurityEmailTemplateBuilder> = {
  newDeviceLogin,
  passwordChanged,
  emailChanged,
}

const globalForTemplates = globalThis as typeof globalThis & {
  __securityEmailTemplates?: Map<string, SecurityEmailTemplateBuilder>
}

const templateRegistry = (globalForTemplates.__securityEmailTemplates ??= new Map<
  string,
  SecurityEmailTemplateBuilder
>())

const key = (type: SecurityEventType, locale: string) => `${type}:${locale}`

/**
 * Register (or override) a security-email template for a `(type, locale)` pair.
 *
 * Themes call this from their bootstrap to brand/translate the built-in security
 * emails without forking core. Pass `'*'` as the locale to override a type for
 * every locale.
 *
 * @example
 * registerSecurityEmailTemplate('newDeviceLogin', 'es', (ctx) => ({
 *   subject: `🔐 Nuevo inicio de sesión en ${ctx.appName}`,
 *   html: renderBranding(ctx),
 * }))
 */
export function registerSecurityEmailTemplate(
  type: SecurityEventType,
  locale: string,
  builder: SecurityEmailTemplateBuilder,
): void {
  templateRegistry.set(key(type, locale), builder)
}

/**
 * Resolve the effective builder for a `(type, locale)`, applying the fallback
 * chain described at the top of the file. Always returns a builder (baseline is
 * guaranteed to exist for every SecurityEventType).
 */
export function getSecurityEmailTemplate(
  type: SecurityEventType,
  locale: string,
): SecurityEmailTemplateBuilder {
  const lang = (locale || '').split('-')[0]

  return (
    templateRegistry.get(key(type, locale)) ??
    (lang && lang !== locale ? templateRegistry.get(key(type, lang)) : undefined) ??
    templateRegistry.get(key(type, '*')) ??
    BASELINE[type]
  )
}

/** Test helper: drop all theme-registered overrides (baseline is untouched). */
export function clearSecurityEmailTemplates(): void {
  templateRegistry.clear()
}
