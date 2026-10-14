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
import { isDomainAllowed } from './registration-helpers';
import { registrationError } from './registration-errors';
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
              const url = request ? new URL(request.url) : null;
              const hasInviteToken = request?.headers.get('x-invite-token') ||
                                   url?.searchParams.get('inviteToken');

              if (!hasInviteToken) {
                // Allow first user bootstrap
                if (await TeamService.isBootstrapDone()) {
                  throw registrationError('SIGNUP_RESTRICTED');
                }
              }
            }

            // For domain-restricted mode, validation happens in database hooks
            // because we need the email from the OAuth provider response

            return ctx;
          },
        },
        {
          // A sign-in code for a domain outside allowedDomains could never be
          // used (the user/session hooks reject it), so refuse it up front and
          // send no email. An email sign-up for such a domain is refused here
          // too: Better Auth 1.7 answers a 403 from user.create.before on
          // /sign-up/email with its generic "account created" response, so the
          // hook's refusal would never reach the form. The answer depends only
          // on the domain, never on whether an account exists, so it reveals
          // nothing about accounts.
          matcher: (ctx) => ctx.path === '/email-otp/send-verification-otp' || ctx.path === '/sign-up/email',
          handler: async (ctx) => {
            const registrationMode = AUTH_CONFIG?.registration?.mode ?? 'open';
            if (registrationMode !== 'domain-restricted' && registrationMode !== 'domain-open') return;
            const allowedDomains = AUTH_CONFIG?.registration?.allowedDomains ?? [];
            const body = ctx.body as { email?: unknown; type?: unknown } | undefined;
            // the handler gets the endpoint context the matcher saw; its type does not declare path
            const signUp = (ctx as { path?: string }).path === '/sign-up/email';
            if ((!signUp && body?.type !== 'sign-in') || typeof body?.email !== 'string' || allowedDomains.length === 0) return;
            if (!isDomainAllowed(body.email, allowedDomains)) {
              // The body is not validated yet: log a bounded, quoted domain so a crafted address cannot forge log lines
              console.log(`[Auth] Refused ${signUp ? 'a sign-up' : 'a sign-in code'} for a user at ${JSON.stringify((body.email.split('@').pop() ?? '').slice(0, 100))}: domain not in allowedDomains`);
              throw registrationError('DOMAIN_NOT_ALLOWED');
            }
          },
        },
      ],
    },
  };
};
