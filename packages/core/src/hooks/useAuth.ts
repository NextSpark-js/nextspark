'use client'

import { useContext, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { QueryClientContext } from '@tanstack/react-query'
import { authClient } from '../lib/auth-client'
import type { SessionUser } from '../lib/auth'
import { useOrigin } from './useOrigin'
import { useLastAuthMethod } from './useLastAuthMethod'
import { safeCallbackPath } from '../lib/auth/callback-url'
import { withBasePath } from '../lib/base-path'
import { loadLoginPage } from '../lib/auth/load-login-page'
import { setSessionHint } from '../lib/auth/session-hint'
import { setUserLocaleClient } from '../lib/locale-client'
import { I18N_CONFIG } from '../lib/config/i18n-config-client'
import { SIGNUP_INTENT_HEADER } from '../lib/api/client-headers'
import type { AuthError } from '../types/auth'

// Keeps a registration-policy code (DOMAIN_NOT_ALLOWED, SIGNUP_RESTRICTED) so forms can show their own message for it
function toAuthError(error: { message?: string; code?: string }, fallback: string): AuthError {
  const authError: AuthError = new Error(error.message || fallback)
  if (error.code === 'DOMAIN_NOT_ALLOWED' || error.code === 'SIGNUP_RESTRICTED') authError.code = error.code
  return authError
}

type SupportedLocale = typeof I18N_CONFIG.supportedLocales[number]

// Esta función ya no se usa directamente aquí
// La creación de metadata se maneja en:
// 1. Email verification: app/(auth)/verify-email/page.tsx
// 2. Dashboard load: useEnsureUserMetadata hook

/**
 * The page Google sign-in returns to, marked with `auth_method=google`.
 *
 * Better Auth accepts a relative callbackURL only when its query is made of
 * word characters and `-.+/=&%@`, and no hash, so the query is written back
 * percent-encoded: a `:` in a timestamp or a filter would otherwise stop the
 * sign-in with INVALID_CALLBACK_URL. Setting the marker replaces one already in
 * the query rather than adding a second.
 */
function googleCallbackURL(redirectTo?: string): string {
  const url = new URL(safeCallbackPath(redirectTo) ?? '/dashboard', 'http://callback.invalid')
  url.searchParams.set('auth_method', 'google')
  return withBasePath(`${url.pathname}${url.search.replace(/\*/g, '%2A')}`)
}

/**
 * After signing in: remember that the browser has a session (see
 * lib/auth/session-hint) and render the next page in the account's language,
 * which the locale cookie decides before anything else.
 */
function rememberSignedIn(user: unknown) {
  setSessionHint(true)
  const language = (user as { language?: unknown } | null | undefined)?.language
  const localeDetected = I18N_CONFIG.supportedLocales.length > 1 && I18N_CONFIG.localeDetection !== false
  if (localeDetected && typeof language === 'string' && I18N_CONFIG.supportedLocales.includes(language as SupportedLocale)) {
    setUserLocaleClient(language)
  }
}

/** The longest the sign-out waits for the session store before it goes on to the login page. */
const SESSION_DROP_TIMEOUT_MS = 2000

/**
 * After a sign-out the client keeps the signed-in user in its session store until its own request for the
 * session answers (it is sent when the sign-out succeeds). Leaving before that lets every
 * signed-in query on the page refetch while the page still sees the user, and the API
 * answers each with 401. So the store is brought up to date first, for at most SESSION_DROP_TIMEOUT_MS:
 * the redirect never depends on that request. Best effort: a store that cannot be refreshed leaves the order as it was.
 *
 * `$store.atoms.session` is an undocumented internal of better-auth, checked against 1.6.30 (client/session-atom.mjs: the atom's
 * value carries `refetch`). If an upgrade renames it this becomes a no-op and the 401s come back:
 * tests/jest/hooks/useAuth.signed-in-data.test.tsx pins the call, re-check it when better-auth is bumped.
 */
async function waitForSessionToDrop() {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const refetch = authClient.$store?.atoms?.session?.get?.()?.refetch?.()
    await Promise.race([refetch, new Promise<void>(resolve => { timer = setTimeout(resolve, SESSION_DROP_TIMEOUT_MS) })])
  } catch {
    // the sign-out itself went through; the page is on its way to the login page
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Sign-in, sign-up and account actions, without subscribing to the session: a
 * page that only acts, like the login and signup forms, makes no session request.
 */
export function useAuthActions() {
  const router = useRouter()
  const origin = useOrigin()
  const { saveAuthMethod } = useLastAuthMethod()
  const queryClient = useContext(QueryClientContext)

  // Cached queries (teams, entity lists, the subscription) belong to whoever was
  // signed in. The root layout's query client outlives the dashboard that used
  // to clear it on logout, so it is emptied whenever someone signs in (a sign-out loads a new page, which drops it).
  const forgetSignedInData = () => queryClient?.clear()


  const handleSignIn = async ({ email, password, redirectTo }: { email: string; password: string; redirectTo?: string }) => {
    const { data, error } = await authClient.signIn.email({
      email,
      password,
    })

    if (error) {
      throw toAuthError(error, 'Failed to sign in')
    }

    if (data) {
      // Save auth method only when login is truly successful
      saveAuthMethod('email')
      forgetSignedInData()
      rememberSignedIn(data.user)
      router.push(safeCallbackPath(redirectTo) ?? '/dashboard')
    }

    return data
  }

  const handleSignUp = async ({ email, password, firstName, lastName, intent }: { email: string; password: string; firstName?: string; lastName?: string; intent?: string }) => {
    // Now Better Auth supports additional fields directly
    const { data, error } = await authClient.signUp.email(
      {
        email,
        password,
        name: `${firstName || ''} ${lastName || ''}`.trim() || email.split('@')[0],
        // @ts-expect-error — pre-existing type error, tracked in https://github.com/NextSpark-js/nextspark/issues/131
        firstName,
        lastName,
      },
      // Optional signup intent, sent as the `x-signup-intent` header. The signup
      // route maps it to an initial team role (AUTH_CONFIG.signupIntent).
      intent ? { headers: { [SIGNUP_INTENT_HEADER]: intent } } : undefined
    )

    if (error) {
      throw toAuthError(error, 'Failed to create account')
    }

    // Para email/password signup, la metadata se crea después de la verificación de email
    // Ver: app/(auth)/verify-email/page.tsx

    return data
  }

  const handleSignOut = async () => {
    // Clear team context from localStorage to prevent data leakage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('activeTeamId')
    }
    // signOut() answers with { error } instead of throwing: a 429 or a network error leaves the server session alive,
    // so the caller shows its error and the page stays as it is
    const { error } = await authClient.signOut()
    if (error) throw new Error(error.message || 'Failed to sign out')
    setSessionHint(false)
    await waitForSessionToDrop()
    // A full navigation, not router.push: with Cache Components the signed-in pages stay mounted (hidden) after a
    // client navigation, and /login came back as the form the last sign-in left (code step, used code) while the
    // dashboard, shown again after the next sign-in, acted on the session it rendered at this sign-out and sent the
    // user back to /login. Loading the page drops all of that state at once (React tree, session store, query
    // cache), so nothing signed-in is left to refetch with the session gone: no query cache clearing here either.
    loadLoginPage()
  }

  /**
   * Passwordless step 1: email a 6-digit sign-in code (Better Auth emailOTP
   * plugin). A first sign-in creates the account, so this doubles as signup.
   */
  const handleSendOtp = async (email: string) => {
    const { data, error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: 'sign-in',
    })

    if (error) {
      throw toAuthError(error, 'Failed to send the sign-in code')
    }

    return data
  }

  /**
   * Passwordless step 2: exchange the emailed code for a session.
   */
  const handleOtpSignIn = async ({ email, otp, redirectTo }: { email: string; otp: string; redirectTo?: string }) => {
    const { data, error } = await authClient.signIn.emailOtp({ email, otp })

    if (error) {
      throw toAuthError(error, 'Invalid or expired code')
    }

    if (data) {
      // OTP is an email-based method for the "last used" badge purposes
      saveAuthMethod('email')
      forgetSignedInData()
      rememberSignedIn(data.user)
      router.push(safeCallbackPath(redirectTo) ?? '/dashboard')
    }

    return data
  }

  const handleGoogleSignIn = async (redirectTo?: string) => {
    // For OAuth, Better Auth handles the redirect automatically
    // The method will be saved on the dashboard page after successful redirect
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: googleCallbackURL(redirectTo)
    })
  }

  const handleResetPassword = async (email: string) => {
    try {
      const { data, error } = await authClient.requestPasswordReset({
        email,
        redirectTo: `${origin}${withBasePath('/reset-password')}`
      })
      
      if (error) {
        return {
          success: false,
          data: undefined,
          error: error.message || 'Failed to send password reset email'
        }
      }
      
      return {
        success: true,
        data,
        error: undefined
      }
    } catch (error) {
      return {
        success: false,
        data: undefined,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      }
    }
  }

  const handleUpdatePassword = async (newPassword: string, token?: string) => {
    try {
      // If token is provided, this is a password reset
      if (token) {
        const { data, error } = await authClient.resetPassword({
          newPassword,
          token
        })
        
        if (error) {
          return {
            success: false,
            data: undefined,
            error: error.message || 'Failed to reset password'
          }
        }
        
        return {
          success: true,
          data,
          error: undefined
        }
      }
      
      // Otherwise, this is a password change for authenticated user
      // This would require current password - not implemented yet
      return {
        success: false,
        data: undefined,
        error: 'Password change for authenticated users not yet implemented'
      }
    } catch (error) {
      return {
        success: false,
        data: undefined,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      }
    }
  }

  const handleChangePassword = async (currentPassword: string, newPassword: string, revokeOtherSessions = false) => {
    try {
      const { data, error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions
      })
      
      if (error) {
        return {
          success: false,
          data: undefined,
          error: error.message || 'Failed to change password'
        }
      }
      
      return {
        success: true,
        data,
        error: undefined
      }
    } catch (error) {
      return {
        success: false,
        data: undefined,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      }
    }
  }

  const handleResendVerificationEmail = async (email: string) => {
    try {
      const { data, error } = await authClient.sendVerificationEmail({
        email
      })
      
      if (error) {
        return {
          success: false,
          data: undefined,
          error: error.message || 'Failed to resend verification email'
        }
      }
      
      return {
        success: true,
        data,
        error: undefined
      }
    } catch (error) {
      return {
        success: false,
        data: undefined,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      }
    }
  }

  return {
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
    googleSignIn: handleGoogleSignIn,
    sendOtp: handleSendOtp,
    signInWithOtp: handleOtpSignIn,
    resetPassword: handleResetPassword,
    updatePassword: handleUpdatePassword,
    changePassword: handleChangePassword,
    resendVerificationEmail: handleResendVerificationEmail,
  }
}

/** The session (user, loading state) and the auth actions. */
export function useAuth() {
  const session = authClient.useSession()
  const actions = useAuthActions()

  // Whatever answer the session gives, the hint follows it; a failed request says nothing
  useEffect(() => {
    if (!session.isPending && !session.error) setSessionHint(Boolean(session.data))
  }, [session.isPending, session.error, session.data])

  return {
    user: session.data?.user as SessionUser | null,
    session: session.data,
    isLoading: session.isPending,
    ...actions,
    isSigningIn: false, // BetterAuth doesn't provide this directly
    isSigningUp: false, // BetterAuth doesn't provide this directly
    signInError: null,
    signUpError: null,
  }
}
