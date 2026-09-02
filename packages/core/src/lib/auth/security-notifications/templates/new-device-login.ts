/**
 * Baseline "new device login" security email (ES/EN).
 * Overridable per (type, locale) via registerSecurityEmailTemplate.
 */

import type { SecurityEmailContext, SecurityEmailContent } from '../types'
import { baseLayout, content, detailRows, escapeHtml, resolveBaselineLocale } from './shared'

const COPY = {
  en: {
    subject: (app: string) => `New sign-in to your ${app} account`,
    heading: 'New device sign-in',
    greeting: (name?: string) => `Hi${name ? ` ${name}` : ''},`,
    intro: (app: string) =>
      `We noticed a sign-in to your ${app} account from a device or location we haven't seen before.`,
    ipLabel: 'IP address',
    deviceLabel: 'Device',
    whenLabel: 'When',
    reassurance:
      "If this was you, you can safely ignore this email. If you don't recognize this activity, change your password immediately.",
    footer: (app: string) => `This is an automated security email from ${app}.`,
  },
  es: {
    subject: (app: string) => `Nuevo inicio de sesión en tu cuenta de ${app}`,
    heading: 'Inicio de sesión desde un nuevo dispositivo',
    greeting: (name?: string) => `Hola${name ? ` ${name}` : ''},`,
    intro: (app: string) =>
      `Detectamos un inicio de sesión en tu cuenta de ${app} desde un dispositivo o ubicación que no habíamos visto antes.`,
    ipLabel: 'Dirección IP',
    deviceLabel: 'Dispositivo',
    whenLabel: 'Fecha',
    reassurance:
      'Si fuiste vos, podés ignorar este correo. Si no reconocés esta actividad, cambiá tu contraseña de inmediato.',
    footer: (app: string) => `Este es un correo de seguridad automático de ${app}.`,
  },
} as const

export default function newDeviceLogin(ctx: SecurityEmailContext): SecurityEmailContent {
  const t = COPY[resolveBaselineLocale(ctx.locale)]
  const app = ctx.appName

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 12px 0;">${escapeHtml(t.greeting(ctx.userName))}</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 8px 0;">${escapeHtml(t.intro(app))}</p>
    ${detailRows([
      { label: t.deviceLabel, value: ctx.userAgent },
      { label: t.ipLabel, value: ctx.ipAddress },
      { label: t.whenLabel, value: ctx.occurredAt },
    ])}
    <p style="color:#b45309;font-size:14px;line-height:1.6;margin:0;">${escapeHtml(t.reassurance)}</p>
  `

  return content(
    t.subject(app),
    baseLayout({ appName: app, heading: t.heading, bodyHtml, footer: t.footer(app) }),
  )
}
