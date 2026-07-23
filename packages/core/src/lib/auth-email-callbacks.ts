import { sendResetPasswordEmail, sendVerifyEmail } from './email/send';
import { I18N_CONFIG } from './config';
import type { EmailProvider } from './email';
import type { UserWithEmail } from './auth';

interface EmailCallbackParams {
  user: UserWithEmail;
  url: string;
  token: string;
}

/**
 * better-auth's own `/request-password-reset` route already builds `url` as
 * `${baseURL}/reset-password/${verificationToken}?callbackURL=${encodeURIComponent(redirectTo)}`
 * — the token lives in the path, `callbackURL` is already correctly encoded.
 * Use it as-is: appending a second `?token=` here (the previous behavior)
 * produces a value with two `?` characters whenever `redirectTo` itself
 * already carries a query string, which better-auth's own callback-URL
 * validation on the follow-up GET request rejects.
 */
export async function sendResetPasswordCallback(
  { user, url, token: _token }: EmailCallbackParams,
  emailService: EmailProvider
): Promise<void> {
  try {
    const template = await sendResetPasswordEmail({
      userName: user.firstName || '',
      resetUrl: url,
      appName: process.env.NEXT_PUBLIC_APP_NAME || 'Your App',
      expiresIn: '1 hour',
    }, I18N_CONFIG.defaultLocale);

    const response = await emailService.send({
      to: user.email,
      ...template,
    });

    if (!response.success) {
      console.error('Failed to send reset password email:', response.error);
      throw new Error('Failed to send reset password email');
    }
  } catch (error) {
    console.error('Error sending reset password email:', error);
    throw error;
  }
}

/**
 * better-auth's own `/send-verification-email` route already builds `url` as
 * `${baseURL}/verify-email?token=${token}&callbackURL=${callbackURL}` — both
 * params correctly `&`-joined. Use it as-is instead of rebuilding a
 * token-only URL, which silently dropped any `callbackURL` a caller supplied.
 */
export async function sendVerificationEmailCallback(
  { user, url, token: _token }: EmailCallbackParams,
  emailService: EmailProvider
): Promise<void> {
  try {
    const template = await sendVerifyEmail({
      userName: user.firstName || '',
      verificationUrl: url,
      appName: process.env.NEXT_PUBLIC_APP_NAME || 'Your App',
    }, I18N_CONFIG.defaultLocale);

    const response = await emailService.send({
      to: user.email,
      ...template,
    });

    if (!response.success) {
      console.error('Failed to send verification email:', response.error);
      throw new Error('Failed to send verification email');
    }
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
}
