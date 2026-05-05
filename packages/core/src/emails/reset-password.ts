/**
 * Core default: Reset Password template.
 *
 * Themes can override by creating `themes/<theme>/emails/reset-password.ts`
 * with a default export matching this contract.
 */

import { getTranslations } from 'next-intl/server';
import type { EmailContent, PasswordResetEmailData } from '../lib/email/types';

const APP_NAME_FALLBACK = process.env.NEXT_PUBLIC_APP_NAME || 'Your App';

export default async function resetPassword(
  data: PasswordResetEmailData,
  locale?: string,
): Promise<EmailContent> {
  const t = await getTranslations({ locale, namespace: 'email.resetPassword' });
  const appName = data.appName || APP_NAME_FALLBACK;
  const year = new Date().getFullYear();
  const greeting = `${t('greetingPrefix')}${data.userName ? ` ${data.userName}` : ''},`;
  const expiresIn = data.expiresIn || t('defaultExpiresIn');

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
                    <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 8px 8px 0 0;">
                      <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">${appName}</h1>
                      <p style="color: #ffffff; font-size: 16px; margin: 10px 0 0 0; opacity: 0.95;">${t('headerSubtitle')}</p>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="color: #333333; font-size: 24px; margin: 0 0 20px 0; font-weight: 600;">${t('title')}</h2>

                      <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        ${greeting}
                      </p>

                      <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                        ${t('intro')}
                      </p>

                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                        <tr>
                          <td style="border-radius: 6px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
                            <a href="${data.resetUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px;">
                              ${t('buttonLabel')}
                            </a>
                          </td>
                        </tr>
                      </table>

                      <div style="margin: 30px 0; padding: 20px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                        <p style="color: #856404; font-size: 14px; margin: 0; font-weight: 600;">
                          ${t('securityNoticeTitle')}
                        </p>
                        <p style="color: #856404; font-size: 14px; margin: 10px 0 0 0; line-height: 1.5;">
                          ${t('securityNoticeExpiry', { expiresIn })}<br>
                          ${t('securityNoticeIgnore')}
                        </p>
                      </div>

                      <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0; padding: 20px; background-color: #f8f8f8; border-radius: 6px;">
                        <strong>${t('helpHeading')}</strong><br>
                        ${t('helpInstructions')}<br>
                        <span style="color: #f5576c; word-break: break-all; font-size: 12px;">${data.resetUrl}</span>
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 40px; background-color: #f8f8f8; border-radius: 0 0 8px 8px; text-align: center;">
                      <p style="color: #999999; font-size: 14px; margin: 0 0 10px 0;">
                        ${t('copyright', { year, appName })}
                      </p>
                      <p style="color: #999999; font-size: 12px; margin: 0;">
                        ${t('footerLine1', { appName })}
                        <br>${t('footerLine2')}
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
