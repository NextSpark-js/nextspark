/**
 * Core default: sign-in link template.
 *
 * Projects can override by creating `emails/magic-link.ts`
 * with a default export matching this contract.
 */

import { getTranslations } from 'next-intl/server';
import { escapeHtml } from '../lib/auth/security-notifications/templates/shared';
import type { EmailContent, MagicLinkEmailData } from '../lib/email/types';
import { DEFAULT_MAGIC_LINK_EXPIRES_IN } from '../lib/auth/otp-config';

const APP_NAME_FALLBACK = process.env.NEXT_PUBLIC_APP_NAME || 'Your App';

export default async function magicLink(
  data: MagicLinkEmailData,
  locale?: string,
): Promise<EmailContent> {
  const t = locale
    ? await getTranslations({ locale, namespace: 'email.magicLink' })
    : await getTranslations('email.magicLink');
  const appName = data.appName || APP_NAME_FALLBACK;
  // The name and the link go into HTML (the subject stays plain text)
  const htmlAppName = escapeHtml(appName);
  const htmlUrl = escapeHtml(data.url);
  const year = new Date().getFullYear();
  // Rounded down so the email never promises more time than the link has
  const expiresInMinutes = Math.floor((data.expiresIn ?? DEFAULT_MAGIC_LINK_EXPIRES_IN) / 60);

  return {
    subject: t('subject', { appName }),
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
                      <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">${htmlAppName}</h1>
                      <p style="color: #ffffff; font-size: 16px; margin: 10px 0 0 0; opacity: 0.95;">${t('headerSubtitle')}</p>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px; text-align: center;">
                      <h2 style="color: #333333; font-size: 24px; margin: 0 0 20px 0; font-weight: 600;">${t('title', { appName: htmlAppName })}</h2>

                      <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                        ${t('intro')}
                      </p>

                      <a href="${htmlUrl}" style="display: inline-block; padding: 14px 32px; background-color: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">${t('button')}</a>

                      <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                        ${t('expiresNotice', { minutes: expiresInMinutes })}<br>
                        ${t('ignoreNotice')}
                      </p>

                      <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0; word-break: break-all;">
                        ${t('linkFallback')}<br>
                        <a href="${htmlUrl}" style="color: #667eea;">${htmlUrl}</a>
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 40px; background-color: #f8f8f8; border-radius: 0 0 8px 8px; text-align: center;">
                      <p style="color: #999999; font-size: 14px; margin: 0 0 10px 0;">
                        ${t('copyright', { year, appName: htmlAppName })}
                      </p>
                      <p style="color: #999999; font-size: 12px; margin: 0;">
                        ${t('footerLine1', { appName: htmlAppName })}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  };
}
