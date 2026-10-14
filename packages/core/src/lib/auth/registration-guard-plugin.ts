/**
 * Better Auth Plugin: Registration Guard
 *
 * Refuses a sign-up the registration mode does not allow before Better Auth
 * runs it, and a sign-in code for a domain outside allowedDomains before it is
 * sent.
 *
 * OAuth callbacks are not matched: a callback cannot tell a new user from an
 * existing one before the provider answers, so the user-creation hook
 * (lib/auth.ts) refuses only an account that would be created, and the callback
 * turns its refusal into a redirect to the error page.
 */

import { AUTH_CONFIG } from '../config';
import { TeamService } from '../services/team.service';
import { shouldSkipTeamCreation } from '../auth-context';
import { isDomainAllowed } from './registration-helpers';
import { registrationError } from './registration-errors';
import type { BetterAuthPlugin } from 'better-auth';

export const registrationGuardPlugin = (): BetterAuthPlugin => {
  return {
    id: 'registration-guard',
    hooks: {
      before: [
        {
          // Sign-up endpoints (/sign-up/email); never an OAuth callback, which may be an existing user's sign-in
          matcher: (ctx) => (ctx.path || '').includes('/sign-up'),
          handler: async (ctx) => {
            const registrationMode = AUTH_CONFIG?.registration?.mode ?? 'open';

            // In invitation-only mode, sign-up needs the invitation flow: the
            // signup context signup-with-invite sets once it has validated the
            // token on the server (as the user-creation hook checks), never a
            // token the client sends. The first user bootstraps without one.
            if (registrationMode === 'invitation-only' && !shouldSkipTeamCreation()) {
              if (await TeamService.isBootstrapDone()) {
                throw registrationError('SIGNUP_RESTRICTED');
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
