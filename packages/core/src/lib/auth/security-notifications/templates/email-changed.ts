/**
 * Baseline "email changed" security email (ES/EN).
 *
 * IMPORTANT: this notification is sent to the OLD address — it is the account
 * owner's last chance to notice (and react to) an attacker moving the account to
 * a new email. The new address will get Better Auth's own verification flow.
 *
 * Overridable per (type, locale) via registerSecurityEmailTemplate.
 */

import type { SecurityEmailContext, SecurityEmailContent } from '../types'
import { baseLayout, content, detailRows, escapeHtml, resolveBaselineLocale } from './shared'

const COPY = {
  en: {
    subject: (app: string) => `Your ${app} email address is being changed`,
    heading: 'Email address change requested',
    greeting: (name?: string) => `Hi${name ? ` ${name}` : ''},`,
    intro: (app: string) =>
      `We received a request to change the email address on your ${app} account.`,
    newLabel: 'New email',
    whenLabel: 'When',
    reassurance:
      "If you requested this, you can ignore this message. If you did NOT request it, contact support immediately — this email address may still control the account until the change is confirmed.",
    footer: (app: string) => `This is an automated security email from ${app}, sent to your current address.`,
  },
  es: {
    subject: (app: string) => `Se está cambiando el correo de tu cuenta de ${app}`,
    heading: 'Solicitud de cambio de correo',
    greeting: (name?: string) => `Hola${name ? ` ${name}` : ''},`,
    intro: (app: string) =>
      `Recibimos una solicitud para cambiar la dirección de correo de tu cuenta de ${app}.`,
    newLabel: 'Nuevo correo',
    whenLabel: 'Fecha',
    reassurance:
      'Si vos lo solicitaste, podés ignorar este mensaje. Si NO lo solicitaste, contactá a soporte de inmediato: esta dirección todavía puede controlar la cuenta hasta que se confirme el cambio.',
    footer: (app: string) =>
      `Este es un correo de seguridad automático de ${app}, enviado a tu dirección actual.`,
  },
} as const

export default function emailChanged(ctx: SecurityEmailContext): SecurityEmailContent {
  const t = COPY[resolveBaselineLocale(ctx.locale)]
  const app = ctx.appName

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 12px 0;">${escapeHtml(t.greeting(ctx.userName))}</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 8px 0;">${escapeHtml(t.intro(app))}</p>
    ${detailRows([
      { label: t.newLabel, value: ctx.newEmail },
      { label: t.whenLabel, value: ctx.occurredAt },
    ])}
    <p style="color:#b45309;font-size:14px;line-height:1.6;margin:0;">${escapeHtml(t.reassurance)}</p>
  `

  return content(
    t.subject(app),
    baseLayout({ appName: app, heading: t.heading, bodyHtml, footer: t.footer(app) }),
  )
}
