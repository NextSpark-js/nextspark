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
import { TeamService } from '../services/team.service';
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

            // Block OAuth in invitation-only mode (unless invite token present or first user)
            if (registrationMode === 'invitation-only') {
              const request = ctx.request;
              const url = new URL(request.url);
              const hasInviteToken = request.headers.get('x-invite-token') ||
                                   url.searchParams.get('inviteToken');

              if (!hasInviteToken) {
                // Allow first user bootstrap (no team exists yet)
                const teamExists = await TeamService.hasGlobal();
                if (teamExists) {
                  throw new Error('SIGNUP_RESTRICTED: Registration requires an invitation');
                }
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
