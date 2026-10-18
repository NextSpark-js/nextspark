/**
 * The email registry of otp-send-failures.test.ts: plain templates, since core's render with next-intl's
 * getTranslations, which needs a Next request. The test is about what happens after the template.
 */
const template = (subject: string) => () => ({ subject, html: `<p>${subject}</p>`, text: subject })

export const EMAIL_REGISTRY = {
  'verify-email': template('Verify your email'),
  'reset-password': template('Reset your password'),
  'otp-verification': template('Your code'),
  'team-invitation': template('You are invited'),
} as const
