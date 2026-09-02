/**
 * Baseline "password changed" security email (ES/EN).
 * Overridable per (type, locale) via registerSecurityEmailTemplate.
 */

import type { SecurityEmailContext, SecurityEmailContent } from '../types'
import { baseLayout, content, escapeHtml, resolveBaselineLocale } from './shared'

const COPY = {
  en: {
    subject: (app: string) => `Your ${app} password was changed`,
    heading: 'Password changed',
    greeting: (name?: string) => `Hi${name ? ` ${name}` : ''},`,
    intro: (app: string) => `The password for your ${app} account was just changed.`,
    reassurance:
      "If you made this change, no action is needed. If you did NOT change your password, reset it immediately and contact support.",
    footer: (app: string) => `This is an automated security email from ${app}.`,
  },
  es: {
    subject: (app: string) => `Se cambió la contraseña de tu cuenta de ${app}`,
    heading: 'Contraseña actualizada',
    greeting: (name?: string) => `Hola${name ? ` ${name}` : ''},`,
    intro: (app: string) => `La contraseña de tu cuenta de ${app} se acaba de cambiar.`,
    reassurance:
      'Si hiciste este cambio, no necesitás hacer nada. Si NO cambiaste tu contraseña, restablecela de inmediato y contactá a soporte.',
    footer: (app: string) => `Este es un correo de seguridad automático de ${app}.`,
  },
} as const

export default function passwordChanged(ctx: SecurityEmailContext): SecurityEmailContent {
  const t = COPY[resolveBaselineLocale(ctx.locale)]
  const app = ctx.appName

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 12px 0;">${escapeHtml(t.greeting(ctx.userName))}</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px 0;">${escapeHtml(t.intro(app))}</p>
    <p style="color:#b45309;font-size:14px;line-height:1.6;margin:0;">${escapeHtml(t.reassurance)}</p>
  `

  return content(
    t.subject(app),
    baseLayout({ appName: app, heading: t.heading, bodyHtml, footer: t.footer(app) }),
  )
}
