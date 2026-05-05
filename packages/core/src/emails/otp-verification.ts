/**
 * Core default: OTP Verification template.
 *
 * Themes can override by creating `themes/<theme>/emails/otp-verification.ts`
 * with a default export matching this contract.
 */

import { getTranslations } from 'next-intl/server';
import type { EmailContent, OtpVerificationEmailData } from '../lib/email/types';

const APP_NAME_FALLBACK = process.env.NEXT_PUBLIC_APP_NAME || 'Your App';
const OTP_EXPIRES_MINUTES = 5;

export default async function otpVerification(
  data: OtpVerificationEmailData,
  locale?: string,
): Promise<EmailContent> {
  const t = await getTranslations({ locale, namespace: 'email.otpVerification' });
  const appName = data.appName || APP_NAME_FALLBACK;
  const year = new Date().getFullYear();

  return {
    subject: t('subject', { otp: data.otp, appName }),
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
                      <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">${appName}</h1>
                      <p style="color: #ffffff; font-size: 16px; margin: 10px 0 0 0; opacity: 0.95;">${t('headerSubtitle')}</p>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px; text-align: center;">
                      <h2 style="color: #333333; font-size: 24px; margin: 0 0 20px 0; font-weight: 600;">${t('title')}</h2>

                      <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                        ${t('intro')}
                      </p>

                      <div style="margin: 0 auto 30px; padding: 20px 40px; background-color: #f8f8f8; border-radius: 8px; display: inline-block;">
                        <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #333333; font-family: monospace;">${data.otp}</span>
                      </div>

                      <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 0;">
                        ${t('expiresNotice', { minutes: OTP_EXPIRES_MINUTES })}<br>
                        ${t('ignoreNotice')}
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
