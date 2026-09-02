/**
 * Mobile App Configuration
 */

import type { AuthLoginMethod } from '@nextsparkjs/mobile'

export const APP_CONFIG = {
  app: {
    name: 'NextSpark Mobile',
    version: '0.1.0',
  },
  /**
   * Login methods offered by the login screen, in priority order. Keep it in
   * sync with the web app's `auth.methods` (the backend serves every method;
   * this only shapes the UI). Default: the passwordless preset — one-time code
   * by email + Google, no password field.
   *
   *   methods: ['email-password', 'google']               // classic
   *   methods: ['email-otp', 'email-password', 'google']  // both, code first
   */
  auth: {
    methods: ['email-otp', 'google'] as AuthLoginMethod[],
  },
  features: {
    tasks: { enabled: true },
    customers: { enabled: true },
  },
  // TODO: Add more config as needed
}
