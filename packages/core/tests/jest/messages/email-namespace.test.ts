/**
 * The server-rendered email templates (`src/emails/*.ts`) resolve their copy
 * with `getTranslations({ namespace: 'email.<template>' })`, which reads the
 * merged core messages built from `messages/<locale>/index.ts`. If a locale
 * index forgets to export the `email` namespace, every email — including the
 * passwordless sign-in code (#126) — goes out with raw keys as subject/body
 * (`MISSING_MESSAGE: Could not resolve email.otpVerification`).
 */
import { describe, test, expect } from '@jest/globals'
import en from '@/core/messages/en/index'
import es from '@/core/messages/es/index'
import de from '@/core/messages/de/index'
import fr from '@/core/messages/fr/index'
import it from '@/core/messages/it/index'
import pt from '@/core/messages/pt/index'

const LOCALES = { en, es, de, fr, it, pt } as Record<string, Record<string, any>>
const EMAIL_TEMPLATES = ['otpVerification', 'verifyEmail', 'resetPassword', 'teamInvitation']

describe('core messages expose the email namespace', () => {
  test.each(Object.keys(LOCALES))('%s exports email.* for every server email template', (locale) => {
    const messages = LOCALES[locale]
    expect(messages.email).toBeDefined()
    for (const template of EMAIL_TEMPLATES) {
      expect(messages.email[template]).toBeDefined()
    }
  })

  test('the OTP sign-in email subject carries the code placeholder', () => {
    for (const locale of Object.keys(LOCALES)) {
      expect(LOCALES[locale].email.otpVerification.subject).toContain('{otp}')
    }
  })
})
