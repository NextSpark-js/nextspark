import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { nextCookies } from "better-auth/next-js";
import { parseSSLConfig, stripSSLParams } from './db';
import { EmailFactory, emailTemplates } from './email';
import { I18N_CONFIG, USER_ROLES_CONFIG, TEAMS_CONFIG, AUTH_CONFIG, APP_CONFIG_MERGED, type UserRole } from './config';
import { getUserFlags } from './services/user-flags.service';
// Direct import to avoid circular dependency: auth -> services/index -> middleware.service -> auth
import { TeamService } from './services/team.service';
import { shouldSkipTeamCreation } from './auth-context';
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

// Supabase transaction pooler (port 6543) requires pgbouncer parameter for Better Auth compatibility
// Strip sslmode from URL to prevent pg-connection-string from overriding our explicit ssl config
const databaseUrl = process.env.DATABASE_URL!;
const cleanUrl = stripSSLParams(databaseUrl);
const connectionString = cleanUrl.includes('?')
  ? `${cleanUrl}&pgbouncer=true`
  : `${cleanUrl}?pgbouncer=true`;

const pool = new Pool({
  connectionString,
  ssl: parseSSLConfig(databaseUrl),
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 20,
});

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
        const template = emailTemplates.resetPassword({
          userName: user.firstName || '',
          resetUrl: resetUrl,
          appName: process.env.NEXT_PUBLIC_APP_NAME || 'Your App',
          expiresIn: '1 hour'
        });
        
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
    sendVerificationEmail: async ({ user, token }: { user: UserWithEmail; url: string; token: string }) => {
      try {
        const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;
        const template = emailTemplates.verifyEmail({
          userName: user.firstName || '',
          verificationUrl: verifyUrl,
          appName: process.env.NEXT_PUBLIC_APP_NAME || 'Your App'
        });
        
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

          // In 'closed' mode, block all new user creation (except via invitation flow)
          if (registrationMode === 'closed') {
            if (!shouldSkipTeamCreation()) {
              // shouldSkipTeamCreation() is true during invitation flow
              // If it's false, this is a public signup attempt - block it
              throw new Error('REGISTRATION_CLOSED: Public registration is not available. Contact an administrator.');
            }
          }

          // In 'domain-restricted' mode, validate email domain
          if (registrationMode === 'domain-restricted') {
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
              case 'multi-tenant':
                // Create team for the user
                await TeamService.create(user.id);
                console.log(`[Teams] Team created for user ${user.id} (mode: ${teamsMode})`);
                break;

              case 'single-tenant':
                // Only first user creates the global team
                // Subsequent users must join via invitation
                const existingTeam = await TeamService.getGlobal();
                if (!existingTeam) {
                  // First user - create the global team
                  const teamName = user.name ? `${user.name}'s Company` : 'Company';
                  await TeamService.create(user.id, teamName);
                  console.log(`[Teams] Global team created for first user ${user.id}`);
                } else {
                  // Team exists - user should have been invited
                  console.warn(`[Teams] User ${user.id} created without team (single-tenant mode)`);
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

          if (registrationMode === 'domain-restricted') {
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
    crossSubDomainCookies: {
      enabled: false,
    },
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