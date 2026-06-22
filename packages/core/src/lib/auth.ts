import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { parseSSLConfig, stripSSLParams } from './db';
import { EmailFactory } from './email';
import {
  sendVerifyEmail,
  sendResetPasswordEmail,
  sendOtpVerificationEmail,
} from './email/send';
import { I18N_CONFIG, USER_ROLES_CONFIG, TEAMS_CONFIG, AUTH_CONFIG, APP_CONFIG_MERGED, type UserRole } from './config';
import { getUserFlags } from './services/user-flags.service';
// Direct imports to avoid circular dependency: auth -> services/index -> middleware.service -> auth
import { TeamService } from './services/team.service';
import { TeamMemberService } from './services/team-member.service';
import { shouldSkipTeamCreation, getSignupContext } from './auth-context';
import {
  isPublicSignupRestricted,
} from './teams/helpers';
import { isDomainAllowed } from './auth/registration-helpers';
import { registrationGuardPlugin } from './auth/registration-guard-plugin';
import { getCorsOrigins } from './utils/cors';

interface UserWithEmail {
  email: string;
  id?: string;
  firstName?: string;
}

interface GoogleProfile {
  email: string;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email_verified?: boolean;
}

const isProd = process.env.NODE_ENV === 'production';
const baseUrl = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173';

// Use the email factory to get the appropriate provider
const emailService = EmailFactory.create();

// Better Auth reads users/account/session/verification WITHOUT a user GUC during
// login/verification (the user is not authenticated yet). Under real RLS those
// tables are locked down (migration 002), so Better Auth must run on the SERVICE
// connection (bypass). Falls back to DATABASE_URL when DATABASE_SERVICE_URL is
// unset (pre-cutover: same owner connection, unchanged behavior).
// Strip sslmode from URL to prevent pg-connection-string from overriding our explicit ssl config
const databaseUrl = process.env.DATABASE_SERVICE_URL || process.env.DATABASE_URL!;
const cleanUrl = stripSSLParams(databaseUrl);
// Supabase transaction pooler (port 6543) requires the pgbouncer parameter for
// Better Auth compatibility. Append it ONLY for pooler URLs — a direct
// connection (typical for the service/owner role) must NOT carry pgbouncer=true,
// which would alter prepared-statement behavior.
const isPoolerUrl = /:6543(\/|$|\?)/.test(databaseUrl) || /pooler/i.test(databaseUrl);
const connectionString = isPoolerUrl
  ? (cleanUrl.includes('?') ? `${cleanUrl}&pgbouncer=true` : `${cleanUrl}?pgbouncer=true`)
  : cleanUrl;

const pool = new Pool({
  connectionString,
  ssl: parseSSLConfig(databaseUrl),
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 20,
});

/**
 * Resolves the current signup request's intent to a configured NON-owner team
 * role, or null. Returns null when signup-intent mapping is disabled, the request
 * carries no intent, the intent is unmapped, or it maps to the creator's default
 * 'owner' role. Single source of truth for both the team-less-signup decision and
 * the post-create role assignment below.
 */
function resolveNonOwnerSignupRole(): string | null {
  const cfg = AUTH_CONFIG.signupIntent;
  if (!cfg?.enabled) return null;
  // The intent for the current request, set by the signup route into context.
  const intent = getSignupContext()?.signupIntent;
  if (!intent) return null;
  const mappedRole = cfg.roleMap?.[intent];
  if (!mappedRole) return null;
  // Only a configured team role that differs from the creator's default 'owner'.
  const validTeamRoles = APP_CONFIG_MERGED.teamRoles?.availableTeamRoles ?? [];
  if (!validTeamRoles.includes(mappedRole) || mappedRole === 'owner') return null;
  return mappedRole;
}

/**
 * Records the resolved signup intent on the user's metadata so the application can
 * recognise a deliberately team-less account (vs a half-finished owner). Uses the
 * privileged pool — this hook runs with no user GUC. Best-effort; the caller's
 * try/catch keeps a failure here from aborting user creation.
 */
async function recordSignupIntentMeta(userId: string, intent: string): Promise<void> {
  // metaValue is jsonb — encode the plain intent string as a JSON string
  // (to_jsonb('client') -> "client"), matching how the rest of users_metas is stored.
  await pool.query(
    `INSERT INTO "users_metas" ("userId", "metaKey", "metaValue", "dataType", "updatedAt")
     VALUES ($1, 'signup_intent', to_jsonb($2::text), 'string', CURRENT_TIMESTAMP)
     ON CONFLICT ("userId", "metaKey")
     DO UPDATE SET "metaValue" = EXCLUDED."metaValue", "updatedAt" = CURRENT_TIMESTAMP`,
    [userId, intent]
  );
}

/**
 * Applies AUTH_CONFIG.signupIntent: maps the current request's signup intent to
 * an initial team role for the user's newly created team. Runs after the team is
 * created. No-ops unless the intent maps to a configured non-owner team role.
 */
async function applySignupIntentRole(
  user: { id: string; [key: string]: unknown },
  teamId: string
): Promise<void> {
  const mappedRole = resolveNonOwnerSignupRole();
  if (!mappedRole) return;
  const intent = getSignupContext()?.signupIntent;
  try {
    // Set the membership role directly (service connection; this hook has no user
    // GUC). TeamMemberService.updateRole would reject changing the creator's owner role.
    await pool.query(
      `UPDATE "team_members" SET role = $1, "updatedAt" = NOW() WHERE "teamId" = $2 AND "userId" = $3`,
      [mappedRole, teamId, user.id]
    );
    console.log(`[Teams] Applied signup intent '${intent}' -> role '${mappedRole}' for user ${user.id} on team ${teamId}`);
  } catch (error) {
    console.error(`[Teams] Failed to apply signup intent role for user ${user.id}:`, error);
  }
}

export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET!,
  user: {
    modelName: "users", // Use plural table name instead of default "user"
    additionalFields: {
      firstName: {
        type: "string",
        required: false,
        input: true, // Allow user to provide this during signup
      },
      lastName: {
        type: "string",
        required: false,
        input: true, // Allow user to provide this during signup
      },
      language: {
        type: "string",
        required: false,
        input: true, // Allow user to provide this during signup
        defaultValue: I18N_CONFIG.defaultLocale, // Set default language
      },
      role: {
        type: "string",
        required: false,
        input: false, // Don't allow users to set their own role
        defaultValue: USER_ROLES_CONFIG.defaultRole, // Default role from config
      },
    },
    // Enable Better Auth's change-email endpoint so `POST /api/auth/change-email`
    // is accepted. Without this the endpoint returns 400
    // `{"message":"Change email is disabled"}` and any theme-level
    // post-success handlers (e.g. notifying the old address that the email
    // was changed) cannot fire end-to-end.
    //
    // We intentionally omit `sendChangeEmailVerification` — the change is
    // processed immediately on POST, and themes can extend their own
    // post-success hooks for double-opt-in or notification flows.
    changeEmail: {
      enabled: true,
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
    sendResetPassword: async ({ user, url, token }: { user: UserWithEmail; url: string; token: string }) => {
      try {
        const resetUrl = `${url}?token=${token}`;
        const template = await sendResetPasswordEmail({
          userName: user.firstName || '',
          resetUrl: resetUrl,
          appName: process.env.NEXT_PUBLIC_APP_NAME || 'Your App',
          expiresIn: '1 hour'
        }, I18N_CONFIG.defaultLocale);
        
        const response = await emailService.send({
          to: user.email,
          ...template
        });
        
        if (!response.success) {
          console.error('Failed to send reset password email:', response.error);
          throw new Error('Failed to send reset password email');
        }
        
      } catch (error) {
        console.error('Error sending reset password email:', error);
        throw error;
      }
    },
  },
  emailVerification: {
    // Controlled by AUTH_CONFIG.sendVerificationEmailOnSignup (default: true).
    // Themes opt out by setting `auth.sendVerificationEmailOnSignup: false`
    // in their app.config.ts when they verify email ownership through other
    // means (OTP, invitation token, claim-account flow, etc.).
    sendOnSignUp: AUTH_CONFIG.sendVerificationEmailOnSignup ?? true,
    sendVerificationEmail: async ({ user, token }: { user: UserWithEmail; url: string; token: string }) => {
      try {
        const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;
        const template = await sendVerifyEmail({
          userName: user.firstName || '',
          verificationUrl: verifyUrl,
          appName: process.env.NEXT_PUBLIC_APP_NAME || 'Your App'
        }, I18N_CONFIG.defaultLocale);
        
        const response = await emailService.send({
          to: user.email,
          ...template
        });
        
        if (!response.success) {
          console.error('Failed to send verification email:', response.error);
          throw new Error('Failed to send verification email');
        }
        
      } catch (error) {
        console.error('Error sending verification email:', error);
        throw error;
      }
    },
    verifyTokenExpiresIn: 60 * 60 * 24, // 24 hours
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      mapProfileToUser: (profile: GoogleProfile) => {
        // Google provides given_name and family_name separately
        const firstName = profile.given_name || profile.name.split(' ')[0] || '';
        const lastName = profile.family_name || profile.name.split(' ').slice(1).join(' ') || '';
        
        return {
          email: profile.email,
          name: profile.name, // Better Auth expects 'name' field
          firstName: firstName, // Use given_name if available, otherwise split name
          lastName: lastName, // Use family_name if available, otherwise split name
          language: I18N_CONFIG.defaultLocale, // Assign default language for Google OAuth
          role: USER_ROLES_CONFIG.defaultRole, // Assign default role for Google OAuth users
          image: profile.picture,
          emailVerified: profile.email_verified || false,
        };
      },
    },
  },
  baseURL: baseUrl,
  // Use unified CORS configuration from app.config.ts + theme extensions + env vars
  trustedOrigins: getCorsOrigins(APP_CONFIG_MERGED),
  // Redirect auth errors to our custom error page instead of Better Auth's default
  onAPIError: {
    errorURL: '/auth-error',
  },
  plugins: [
    registrationGuardPlugin(), // Intercept OAuth signup attempts
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        const template = await sendOtpVerificationEmail({
          email,
          otp,
          type,
          appName: process.env.NEXT_PUBLIC_APP_NAME || 'Your App',
        }, I18N_CONFIG.defaultLocale);
        await emailService.send({ to: email, ...template });
      },
      otpLength: 6,
      expiresIn: 300, // 5 minutes
      sendVerificationOnSignUp: false,
      disableSignUp: false, // auto-create user on first OTP sign-in
    }),
    nextCookies(), // MUST be the last plugin for Next.js cookie handling
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 1 week
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  // Database hooks for user lifecycle events (Better Auth API)
  databaseHooks: {
    user: {
      create: {
        // Validate registration mode before creating user
        before: async (user: { email: string; [key: string]: unknown }) => {
          const registrationMode = AUTH_CONFIG?.registration?.mode ?? 'open';

          // In 'invitation-only' mode, block new user creation (except via invitation flow or first user)
          if (registrationMode === 'invitation-only') {
            if (!shouldSkipTeamCreation()) {
              // shouldSkipTeamCreation() is true during invitation flow
              // If it's false, check if this is the first user (team bootstrap)
              const existingTeam = await TeamService.getGlobal();
              if (existingTeam) {
                // Team exists, so this is not the first user - block it
                throw new Error('SIGNUP_RESTRICTED: Registration requires an invitation. Contact an administrator.');
              }
            }
          }

          // In 'domain-restricted' and 'domain-open' modes, validate email domain
          // Empty allowedDomains list = allow all domains (permissive fallback)
          if (registrationMode === 'domain-restricted' || registrationMode === 'domain-open') {
            const allowedDomains = AUTH_CONFIG?.registration?.allowedDomains ?? [];
            if (allowedDomains.length > 0 && !isDomainAllowed(user.email, allowedDomains)) {
              console.log(`[Auth] Blocked registration for ${user.email}: domain not in allowedDomains (allowed: ${allowedDomains.join(', ')})`);
              throw new Error(`DOMAIN_NOT_ALLOWED: Email domain not authorized. Please use an email from: ${allowedDomains.join(', ')}`);
            }
          }

          return user;
        },
        // Create team when a new user signs up (email/password or OAuth)
        // Team type depends on configured teams mode
        after: async (user: { id: string; name?: string; [key: string]: unknown }) => {
          try {
            // Check if we should skip team creation (e.g., user created via invite)
            if (shouldSkipTeamCreation()) {
              console.log(`[Teams] Skipping team creation for user ${user.id} (invite flow)`);
              return;
            }

            const teamsMode = TEAMS_CONFIG.mode;

            // Handle team creation based on mode
            switch (teamsMode) {
              case 'single-user':
              case 'multi-tenant': {
                // A signup whose intent maps to a non-owner role can be configured
                // (signupIntent.skipTeamForNonOwnerIntents) to create NO team at
                // all: the account is intentionally team-less and operates as a
                // plain authenticated user. The intent is recorded in users_metas
                // so the app can tell a deliberate team-less account from a
                // half-finished owner. Opt-in; with the flag off (default) every
                // signup gets a team and the non-owner role is applied to it.
                const nonOwnerRole = resolveNonOwnerSignupRole();
                if (nonOwnerRole && AUTH_CONFIG.signupIntent?.skipTeamForNonOwnerIntents) {
                  const intent = getSignupContext()?.signupIntent ?? nonOwnerRole;
                  await recordSignupIntentMeta(user.id, intent);
                  console.log(`[Teams] Skipping auto-team for user ${user.id} (non-owner signup intent '${intent}')`);
                  break;
                }
                // Create team for the user
                const createdTeam = await TeamService.create(user.id);
                console.log(`[Teams] Team created for user ${user.id} (mode: ${teamsMode})`);
                // Apply the signup-intent → initial team role mapping (if configured).
                await applySignupIntentRole(user, createdTeam.id);
                break;
              }

              case 'single-tenant':
                // First user creates the global team; subsequent users auto-join it.
                // Access control is handled by registration.mode (domain-open, invitation-only, etc.)
                // so any user who passes registration validation should be part of the org.
                const existingTeam = await TeamService.getGlobal();
                if (!existingTeam) {
                  // First user - create the global team
                  const teamName = user.name ? `${user.name}'s Company` : 'Company';
                  await TeamService.create(user.id, teamName);
                  console.log(`[Teams] Global team created for first user ${user.id}`);
                } else {
                  // Subsequent users - auto-join the global team as member
                  await TeamMemberService.addToGlobal(user.id, 'member');
                  console.log(`[Teams] User ${user.id} auto-joined global team (single-tenant mode)`);
                }
                break;

              default:
                console.warn(`[Teams] Unknown teams mode: ${teamsMode}`);
            }
          } catch (error) {
            // Log error but don't fail user creation
            console.error(`[Teams] Failed to create team for user ${user.id}:`, error);
          }
        }
      }
    },
    session: {
      create: {
        // Enforce domain restrictions on EVERY login (not just signup)
        before: async (session: { userId: string; [key: string]: unknown }) => {
          const registrationMode = AUTH_CONFIG?.registration?.mode ?? 'open';

          if (registrationMode === 'domain-restricted' || registrationMode === 'domain-open') {
            const allowedDomains = AUTH_CONFIG?.registration?.allowedDomains ?? [];
            if (allowedDomains.length > 0) {
              // Look up user email from DB
              const result = await pool.query(
                'SELECT email FROM users WHERE id = $1 LIMIT 1',
                [session.userId]
              );
              const email = result.rows[0]?.email;
              if (email && !isDomainAllowed(email, allowedDomains)) {
                console.log(`[Auth] Blocked sign-in for ${email}: domain not in allowedDomains`);
                return false; // Abort session creation
              }
            }
          }

          return session;
        },
      },
    },
  },
  callbacks: {
    session: {
      // Add user flags to session data
      async onSignIn({ user, session }: { user: { id: string; [key: string]: unknown }; session: { [key: string]: unknown } }) {
        try {
          const flags = await getUserFlags(user.id);

          return {
            user: {
              ...user,
              flags
            },
            session
          };
        } catch (error) {
          console.error('Error loading user flags in session:', error);
          // Return session without flags if there's an error
          return {
            user: {
              ...user,
              flags: []
            },
            session
          };
        }
      },
      // Ensure flags are available in session retrieval
      async onSessionUpdate({ user, session }: { user: { id: string; [key: string]: unknown }; session: { [key: string]: unknown } }) {
        try {
          const flags = await getUserFlags(user.id);

          return {
            user: {
              ...user,
              flags
            },
            session
          };
        } catch (error) {
          console.error('Error loading user flags in session update:', error);
          return {
            user: {
              ...user,
              flags: user.flags || []
            },
            session
          };
        }
      }
    }
  },
  // Removed additionalFields - will use standard name and image fields
  advanced: {
    // Cross-subdomain session cookies (opt-in via env).
    //
    // When an app serves tenants on subdomains (e.g. `<tenant>.example.com`)
    // but runs OAuth on the apex, Google/social `redirect_uri` can only point
    // at the apex (providers don't allow wildcard redirect URIs), so the
    // session is established on the apex callback. For that session to be
    // readable back on the tenant subdomain, the cookie must be scoped to the
    // shared base domain rather than a single host.
    //
    // Off by default (cookies stay host-scoped). Set COOKIE_BASE_DOMAIN to the
    // shared base domain WITH a leading dot (e.g. ".example.com") to enable it.
    // The domain is passed explicitly because Better Auth's default derivation
    // uses the full hostname (e.g. `www.example.com`), which does not span
    // sibling subdomains.
    crossSubDomainCookies: process.env.COOKIE_BASE_DOMAIN
      ? { enabled: true, domain: process.env.COOKIE_BASE_DOMAIN }
      : { enabled: false },
    useSecureCookies: isProd,
    defaultCookieAttributes: {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax" as const,
      path: "/",
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type SessionUser = typeof auth.$Infer.Session.user & {
  name?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  timezone?: string;
  language?: string;
  role?: UserRole;
  flags?: import('./entities/types').UserFlag[];
};

/**
 * Typed session with extended user properties
 * Use this type when working with sessions that include additionalFields
 */
export interface TypedSession {
  session: Session['session'];
  user: SessionUser;
}

/**
 * Get session with properly typed user object
 *
 * Better-auth's getSession doesn't infer additionalFields types correctly.
 * This helper wraps the call and provides the correct TypeScript types.
 *
 * @param headers - Request headers containing session cookie
 * @returns Typed session or null if not authenticated
 *
 * @example
 * ```ts
 * const session = await getTypedSession(request.headers);
 * if (session?.user.role === 'admin') {
 *   // TypeScript knows about role
 * }
 * ```
 */
export async function getTypedSession(
  headers: Headers
): Promise<TypedSession | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;

  // Cast to typed session - the data is there at runtime,
  // better-auth just doesn't infer the types correctly
  return session as unknown as TypedSession;
}