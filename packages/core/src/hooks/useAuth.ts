'use client'

import { useRouter } from 'next/navigation'
import { authClient } from '../lib/auth-client'
import type { SessionUser } from '../lib/auth'
import { useOrigin } from './useOrigin'
import { useLastAuthMethod } from './useLastAuthMethod'

// Esta función ya no se usa directamente aquí
// La creación de metadata se maneja en:
// 1. Email verification: app/(auth)/verify-email/page.tsx
// 2. Dashboard load: useEnsureUserMetadata hook

export function useAuth() {
  const router = useRouter()
  const session = authClient.useSession()
  const origin = useOrigin()
  const { saveAuthMethod } = useLastAuthMethod()
  
  const handleSignIn = async ({ email, password, redirectTo }: { email: string; password: string; redirectTo?: string }) => {
    const { data, error } = await authClient.signIn.email({
      email,
      password,
    })

    if (error) {
      throw new Error(error.message || 'Error al iniciar sesión')
    }

    if (data) {
      // Save auth method only when login is truly successful
      saveAuthMethod('email')
      router.push(redirectTo || '/dashboard')
    }

    return data
  }

  const handleSignUp = async ({ email, password, firstName, lastName }: { email: string; password: string; firstName?: string; lastName?: string }) => {
    // Now Better Auth supports additional fields directly
    const { data, error } = await authClient.signUp.email({
      email,
      password,
      name: `${firstName || ''} ${lastName || ''}`.trim() || email.split('@')[0],
      firstName,
      lastName,
    })

    if (error) {
      throw new Error(error.message || 'Failed to create account')
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
    await authClient.signOut()
    router.push('/login')
  }

  const handleGoogleSignIn = async (redirectTo?: string) => {
    // For OAuth, Better Auth handles the redirect automatically
    // The method will be saved on the dashboard page after successful redirect
    const callbackURL = redirectTo
      ? `${redirectTo}${redirectTo.includes('?') ? '&' : '?'}auth_method=google`
      : '/dashboard?auth_method=google'
    await authClient.signIn.social({
      provider: 'google',
      callbackURL
    })
  }

  const handleResetPassword = async (email: string) => {
    try {
      const { data, error } = await authClient.forgetPassword({
        email,
        redirectTo: `${origin}/reset-password`
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
    user: session.data?.user as SessionUser | null,
    session: session.data,
    isLoading: session.isPending,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
    googleSignIn: handleGoogleSignIn,
    resetPassword: handleResetPassword,
    updatePassword: handleUpdatePassword,
    changePassword: handleChangePassword,
    resendVerificationEmail: handleResendVerificationEmail,
    isSigningIn: false, // BetterAuth doesn't provide this directly
    isSigningUp: false, // BetterAuth doesn't provide this directly
    signInError: null,
    signUpError: null,
  }
}