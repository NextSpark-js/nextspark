import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { emailOTPClient } from "better-auth/client/plugins";
import type { auth } from "./auth";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173",
  plugins: [
    inferAdditionalFields<typeof auth>(),
    emailOTPClient(),
  ]
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  sendVerificationEmail,
  emailOtp,
} = authClient;

/**
 * Force a REAL session-cookie refresh from the browser.
 *
 * Better Auth renews a session (rolling `updateAge`) whenever `getSession` is
 * called — but the re-issued cookie only reaches the browser when the call runs
 * in a context that can write cookies (Route Handler / Server Action). Session
 * reads during Server Component render use `disableRefresh`, so an app that is
 * only ever opened through server-rendered pages (typical for an installed PWA)
 * would never get its cookie renewed.
 *
 * This helper hits Better Auth's own `GET /api/auth/get-session` endpoint —
 * served by the `app/api/auth/[...all]` Route Handler, where `Set-Cookie`
 * works — bypassing the cookie cache so the check reaches the database and the
 * renewal is applied when due. Wire it with `useSessionCookieRefresh()` /
 * `<SessionCookieRefresher />` (app open, tab visible again, back online).
 */
export async function refreshSessionCookie() {
  return authClient.getSession({ query: { disableCookieCache: true } });
}