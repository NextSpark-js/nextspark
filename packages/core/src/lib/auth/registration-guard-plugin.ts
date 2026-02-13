/**
 * Better Auth Plugin: Registration Guard
 *
 * This plugin intercepts OAuth signup attempts BEFORE user creation to enforce
 * registration mode restrictions at the earliest possible point.
 *
 * Security layers:
 * 1. This plugin (OAuth pre-validation)
 * 2. API route handler (endpoint blocking)
 * 3. Database hooks (final validation)
 */

import { AUTH_CONFIG } from '../config';
import type { BetterAuthPlugin } from 'better-auth';

export const registrationGuardPlugin = (): BetterAuthPlugin => {
  return {
    id: 'registration-guard',
    hooks: {
      before: [
        {
          // Intercept social signup attempts
          matcher: (ctx) => {
            const path = ctx.path || '';
            return (
              path.includes('/sign-up/social') ||
              path.includes('/callback/') ||
              path.includes('/sign-up')
            );
          },
          handler: async (ctx) => {
            const registrationMode = AUTH_CONFIG?.registration?.mode ?? 'open';

            // Block OAuth in closed mode (unless invitation token present)
            if (registrationMode === 'closed') {
              const request = ctx.request;
              const url = new URL(request.url);
              const hasInviteToken = request.headers.get('x-invite-token') ||
                                   url.searchParams.get('inviteToken');

              if (!hasInviteToken) {
                throw new Error('REGISTRATION_CLOSED: Public registration is not available');
              }
            }

            // For domain-restricted mode, validation happens in database hooks
            // because we need the email from the OAuth provider response

            return ctx;
          },
        },
      ],
    },
  };
};
