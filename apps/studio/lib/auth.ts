/**
 * Better Auth server configuration for Studio.
 *
 * Email/password only — GitHub OAuth stays separate for push feature.
 * Supports invite-only mode via STUDIO_REGISTRATION env.
 */

import { betterAuth } from 'better-auth'
import { nextCookies } from 'better-auth/next-js'
import { pool } from './db'

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4000'
const isHttps = appUrl.startsWith('https://')

export const auth = betterAuth({
  baseURL: appUrl,
  database: pool,
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,   // 7 days
    updateAge: 60 * 60 * 24,        // refresh daily
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,               // 5 min cookie cache
    },
  },
  trustedOrigins: [appUrl],
  advanced: {
    // Only use Secure cookies when served over HTTPS.
    // Without this, NODE_ENV=production forces Secure cookies
    // which breaks session persistence over plain HTTP.
    useSecureCookies: isHttps,
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'user',
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Check if registration is allowed
          const mode = process.env.STUDIO_REGISTRATION || 'open'

          if (mode === 'invite') {
            // Allow first user (bootstrap), block subsequent
            const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM "user"')
            const count = rows[0]?.count ?? 0

            if (count > 0) {
              throw new Error('Registration is invite-only')
            }
          }

          return { data: user }
        },
        after: async (user) => {
          // First user becomes admin
          const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM "user"')
          const count = rows[0]?.count ?? 0

          if (count <= 1) {
            await pool.query('UPDATE "user" SET role = $1 WHERE id = $2', ['admin', user.id])
          }
        },
      },
    },
  },
  plugins: [nextCookies()],
})
