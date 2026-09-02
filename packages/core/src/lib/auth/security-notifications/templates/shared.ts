/**
 * Shared helpers for the baseline security-email templates.
 *
 * The baseline templates ship self-contained ES/EN copy (no next-intl
 * dependency) so they render correctly inside the scheduled-action worker with
 * zero i18n wiring, and so unit tests stay hermetic. Themes that want full
 * branding or additional locales register their own builders via
 * `registerSecurityEmailTemplate(type, locale, builder)` — those take
 * precedence over everything here.
 */

import type { SecurityEmailContent } from '../types'

/** Locales the baseline copy is written in. Anything else falls back to 'en'. */
export type BaselineLocale = 'es' | 'en'

/** Map any BCP47 locale to the closest baseline locale ('es' or 'en'). */
export function resolveBaselineLocale(locale: string | undefined): BaselineLocale {
  return (locale || '').toLowerCase().startsWith('es') ? 'es' : 'en'
}

/** Escape a value for safe interpolation into HTML text/attributes. */
export function escapeHtml(value: string | undefined | null): string {
  if (value == null) return ''
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Wrap body content in a minimal, email-client-safe HTML shell. Kept intentionally
 * plain (no gradients/branding) — this is the neutral baseline; themes override
 * for a branded look.
 */
export function baseLayout(params: {
  appName: string
  heading: string
  bodyHtml: string
  footer: string
}): string {
  const { appName, heading, bodyHtml, footer } = params
  const year = new Date().getFullYear()
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f4f4;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding:40px 0;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.08);">
            <tr>
              <td style="padding:32px 40px 8px 40px;">
                <h1 style="color:#111827;font-size:20px;margin:0;font-weight:600;">${escapeHtml(appName)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 40px 24px 40px;">
                <h2 style="color:#111827;font-size:22px;margin:0 0 16px 0;font-weight:600;">${escapeHtml(heading)}</h2>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 40px 32px 40px;border-top:1px solid #eee;">
                <p style="color:#9ca3af;font-size:12px;line-height:1.5;margin:16px 0 0 0;">
                  ${escapeHtml(footer)}<br>
                  &copy; ${year} ${escapeHtml(appName)}.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/** Render a labeled detail row block (used by the new-device email). */
export function detailRows(rows: Array<{ label: string; value: string | undefined }>): string {
  const cells = rows
    .filter((r) => r.value)
    .map(
      (r) =>
        `<tr><td style="color:#6b7280;font-size:14px;padding:4px 12px 4px 0;">${escapeHtml(
          r.label,
        )}</td><td style="color:#111827;font-size:14px;padding:4px 0;">${escapeHtml(
          r.value,
        )}</td></tr>`,
    )
    .join('')
  if (!cells) return ''
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 24px 0;background:#f9fafb;border-radius:6px;padding:8px 16px;">${cells}</table>`
}

/** Build a `SecurityEmailContent` with an auto-derived plain-text fallback. */
export function content(subject: string, html: string, text?: string): SecurityEmailContent {
  return { subject, html, text: text ?? subject }
}
