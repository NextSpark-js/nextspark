/**
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, jest } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Reset modules to clear any cached versions
beforeAll(() => {
  jest.resetModules()
})


// Import LoginForm after mocking
import { LoginForm } from '@/core/components/auth/forms/LoginForm'

// Mock useAuth hook
const mockSignIn = jest.fn()
const mockGoogleSignIn = jest.fn()
const mockUseAuth = {
  signIn: mockSignIn,
  googleSignIn: mockGoogleSignIn,
  user: null,
  session: null,
  isLoading: false,
  signUp: jest.fn(),
  signOut: jest.fn(),
  resetPassword: jest.fn(),
  updatePassword: jest.fn(),
  changePassword: jest.fn(),
  resendVerificationEmail: jest.fn(),
  isSigningIn: false,
  isSigningUp: false,
  signInError: null,
  signUpError: null,
}

jest.mock('@/core/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth
}))

// Mock useLastAuthMethod hook
const mockSaveAuthMethod = jest.fn()
const mockUseLastAuthMethod = {
  lastMethod: null,
  saveAuthMethod: mockSaveAuthMethod,
  clearAuthMethod: jest.fn(),
  isReady: true,
}

jest.mock('@/core/hooks/useLastAuthMethod', () => ({
  useLastAuthMethod: () => mockUseLastAuthMethod
}))

// Mock next-intl - mapping keys used by LoginForm component with useTranslations('auth')
const mockTranslations = {
  // Core login keys (auth namespace + login.*)
  'login.title': 'Sign In',
  'login.description': 'Enter your credentials to access your account',
  
  // Form fields
  'login.form.email': 'Email',
  'login.form.emailPlaceholder': 'Enter your email',
  'login.form.password': 'Password',
  'login.form.passwordPlaceholder': 'Enter your password',
  'login.form.signInButton': 'Sign In',
  'login.form.signingIn': 'Signing in...',
  'login.form.continueWithGoogle': 'Continue with Google',
  'login.form.continueWithGoogleAria': 'Continue with Google',
  'login.form.loginWithEmail': 'Sign in with Email',
  'login.form.lastUsed': 'Last Used',
  'login.form.orContinueWith': 'Or continue with',
  'login.form.rememberMe': 'Remember me',
  'login.form.forgotPassword': 'Forgot password?',
  'login.form.forgotPasswordAria': 'Reset your password',
  'login.form.submitHelp': 'Press Enter to submit the form',
  'login.form.backToGoogle': 'Back to main options',
  
  // Footer
  'login.footer.noAccount': "Don't have an account?",
  'login.footer.signUp': 'Sign up',
  'login.footer.signUpAria': 'Create new account',
  
  // Messages
  'login.messages.signingIn': 'Signing in...',
  'login.messages.signInSuccess': 'Sign in successful',
  'login.messages.signInFailed': 'Sign in failed',
  'login.messages.signInError': 'Sign in error: {error}',
  'login.messages.googleSigningIn': 'Redirecting to Google...',
  'login.messages.googleSignInSuccess': 'Google sign in successful',
  'login.messages.googleSignInFailed': 'Google sign in failed',
  'login.messages.googleSignInError': 'Google sign in error: {error}',
}

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, options?: any) => {
    const translation = mockTranslations[key as keyof typeof mockTranslations]
    if (options?.error) {
      return translation?.replace('{error}', options.error) || key
    }
    return translation || key
  }
}))

// Mock testing utils
jest.mock('@/core/lib/test', () => ({
  sel: jest.fn((path: string) => {
    // Map selector paths to expected values
    const selectors: Record<string, string> = {
      'auth.login.card': 'login-form-card',
      'auth.login.header': 'login-header',
      'auth.login.form': 'login-form',
      'auth.login.emailInput': 'login-email-input',
      'auth.login.passwordInput': 'login-password-input',
      'auth.login.submit': 'login-submit',
      'auth.login.googleSignin': 'login-google-signin',
      'auth.login.emailSignin': 'login-email-signin',
      'auth.login.backToMain': 'login-back-to-main',
      'auth.login.forgotPassword': 'login-forgot-password',
      'auth.login.rememberMe': 'login-remember-me',
      'auth.login.signupLink': 'login-signup-link',
    }
    return selectors[path] || `INVALID_SELECTOR_${path}`
  })
}))

describe('LoginForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset auth method state
    mockUseLastAuthMethod.lastMethod = null
    mockUseLastAuthMethod.isReady = true
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    test('should render login form with all essential elements', () => {
      render(<LoginForm />)

      expect(screen.getByText('Sign In')).toBeInTheDocument()
      expect(screen.getByText('Enter your credentials to access your account')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in with email/i })).toBeInTheDocument()
    })

    test('should have proper accessibility attributes', () => {
      render(<LoginForm />)

      // Check ARIA attributes
      expect(screen.getByRole('heading', { name: 'Sign In' })).toHaveAttribute('id', 'login-heading')
      expect(screen.getByTestId('login-status-message')).toHaveAttribute('aria-live', 'polite')
    })

    test('should render data-cy attributes for testing', () => {
      render(<LoginForm />)

      expect(screen.getByTestId('login-card')).toHaveAttribute('data-cy', 'login-form-card')
      expect(screen.getByTestId('login-google-button')).toHaveAttribute('data-cy', 'login-google-signin')
    })
  })

  describe('Last Used Badge Behavior', () => {
    test('should show badge for Google when last method is google and isReady', () => {
      mockUseLastAuthMethod.lastMethod = 'google'
      mockUseLastAuthMethod.isReady = true

      render(<LoginForm />)

      expect(screen.getByText('Last Used')).toBeInTheDocument()

      // Should be on the Google button
      const googleButton = screen.getByRole('button', { name: /continue with google/i })
      expect(googleButton.closest('div')).toContainElement(screen.getByText('Last Used'))
    })

    test('should show badge for email when last method is email and isReady', () => {
      mockUseLastAuthMethod.lastMethod = 'email'
      mockUseLastAuthMethod.isReady = true

      render(<LoginForm />)

      expect(screen.getByText('Last Used')).toBeInTheDocument()

      // Should be on the email button
      const emailButton = screen.getByRole('button', { name: /sign in with email/i })
      expect(emailButton.closest('div')).toContainElement(screen.getByText('Last Used'))
    })

    test('should not show badge when isReady is false', () => {
      mockUseLastAuthMethod.lastMethod = 'google'
      mockUseLastAuthMethod.isReady = false

      render(<LoginForm />)

      expect(screen.queryByText('Last Used')).not.toBeInTheDocument()
    })

    test('should not show badge when lastMethod is null', () => {
      mockUseLastAuthMethod.lastMethod = null
      mockUseLastAuthMethod.isReady = true

      render(<LoginForm />)

      expect(screen.queryByText('Last Used')).not.toBeInTheDocument()
    })
  })

  describe('Google Authentication', () => {
    test('should call googleSignIn when Google button is clicked', async () => {
      const user = userEvent.setup()
      mockGoogleSignIn.mockResolvedValue({})

      render(<LoginForm />)

      const googleButton = screen.getByRole('button', { name: /continue with google/i })
      await user.click(googleButton)

      expect(mockGoogleSignIn).toHaveBeenCalledTimes(1)
    })

    test('should show loading state during Google authentication', async () => {
      const user = userEvent.setup()
      mockGoogleSignIn.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      render(<LoginForm />)

      const googleButton = screen.getByRole('button', { name: /continue with google/i })
      await user.click(googleButton)

      // Should show loading indicator
      expect(screen.getByText('Redirecting to Google...')).toBeInTheDocument()
      expect(googleButton).toBeDisabled()

      await waitFor(() => {
        expect(mockGoogleSignIn).toHaveBeenCalled()
      })
    })

    test('should handle Google authentication errors', async () => {
      const user = userEvent.setup()
      const errorMessage = 'Google authentication failed'
      mockGoogleSignIn.mockRejectedValue(new Error(errorMessage))

      render(<LoginForm />)

      const googleButton = screen.getByRole('button', { name: /continue with google/i })
      await user.click(googleButton)

      await waitFor(() => {
        expect(screen.getByText('Google sign in error: login.errors.google.oauthError')).toBeInTheDocument()
      })
    })

    test('should NOT call saveAuthMethod directly in LoginForm for Google auth', async () => {
      const user = userEvent.setup()
      mockGoogleSignIn.mockResolvedValue({})

      render(<LoginForm />)

      const googleButton = screen.getByRole('button', { name: /continue with google/i })
      await user.click(googleButton)

      await waitFor(() => {
        expect(mockGoogleSignIn).toHaveBeenCalled()
      })

      // Auth method saving should NOT happen in LoginForm for Google OAuth
      // It should happen via useAuthMethodDetector in dashboard layout
      expect(mockSaveAuthMethod).not.toHaveBeenCalled()
    })
  })

  describe('Email Form Display', () => {
    test('should show email form when "Sign in with Email" is clicked', async () => {
      const user = userEvent.setup()

      render(<LoginForm />)

      const emailButton = screen.getByRole('button', { name: /sign in with email/i })
      await user.click(emailButton)

      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
    })

    test('should hide email form when "Back to main options" is clicked', async () => {
      const user = userEvent.setup()

      render(<LoginForm />)

      // Show email form first
      const emailButton = screen.getByRole('button', { name: /sign in with email/i })
      await user.click(emailButton)

      expect(screen.getByLabelText('Email')).toBeInTheDocument()

      // Hide email form
      const backButton = screen.getByRole('button', { name: /back to main options/i })
      await user.click(backButton)

      expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
    })
  })

  describe('Email Authentication', () => {
    test('should call signIn with correct credentials when form is submitted', async () => {
      const user = userEvent.setup()
      mockSignIn.mockResolvedValue({})

      render(<LoginForm />)

      // Show email form
      await user.click(screen.getByRole('button', { name: /sign in with email/i }))

      // Fill form
      await user.type(screen.getByLabelText('Email'), 'test@example.com')
      await user.type(screen.getByLabelText('Password'), 'password123')

      // Submit form
      await user.click(screen.getByRole('button', { name: 'Sign In' }))

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123'
        })
      })
    })

    test('should NOT call saveAuthMethod directly in LoginForm for email auth', async () => {
      const user = userEvent.setup()
      mockSignIn.mockResolvedValue({})

      render(<LoginForm />)

      // Show email form
      await user.click(screen.getByRole('button', { name: /sign in with email/i }))

      // Fill and submit form
      await user.type(screen.getByLabelText('Email'), 'test@example.com')
      await user.type(screen.getByLabelText('Password'), 'password123')
      await user.click(screen.getByRole('button', { name: 'Sign In' }))

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalled()
      })

      // Auth method saving should NOT happen in LoginForm for email auth
      // It should happen in useAuth.handleSignIn after successful auth
      expect(mockSaveAuthMethod).not.toHaveBeenCalled()
    })

    test('should show loading state during email authentication', async () => {
      const user = userEvent.setup()
      mockSignIn.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      render(<LoginForm />)

      // Show email form
      await user.click(screen.getByRole('button', { name: /sign in with email/i }))

      // Fill and submit form
      await user.type(screen.getByLabelText('Email'), 'test@example.com')
      await user.type(screen.getByLabelText('Password'), 'password123')
      await user.click(screen.getByRole('button', { name: 'Sign In' }))

      // Should show loading state in status message
      await waitFor(() => {
        expect(screen.getByTestId('login-status-message')).toHaveTextContent('Signing in...')
      })
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
    })

    test('should handle email authentication errors', async () => {
      const user = userEvent.setup()
      const errorMessage = 'Invalid credentials'
      mockSignIn.mockRejectedValue(new Error(errorMessage))

      render(<LoginForm />)

      // Show email form
      await user.click(screen.getByRole('button', { name: /sign in with email/i }))

      // Fill and submit form
      await user.type(screen.getByLabelText('Email'), 'test@example.com')
      await user.type(screen.getByLabelText('Password'), 'wrongpassword')
      await user.click(screen.getByRole('button', { name: 'Sign In' }))

      await waitFor(() => {
        expect(screen.getByText('Sign in error: login.errors.invalidCredentials')).toBeInTheDocument()
      })
    })
  })

  describe('Form Validation', () => {
    test('should show validation errors for invalid email', async () => {
      const user = userEvent.setup()

      render(<LoginForm />)

      // Show email form
      await user.click(screen.getByRole('button', { name: /sign in with email/i }))

      // Leave email empty and enter valid password
      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')

      await user.clear(emailInput)
      // Don't type anything in email - leave it empty to trigger required validation
      await user.clear(passwordInput)
      await user.type(passwordInput, 'validpassword123') // Valid password

      // Submit form to trigger validation
      await user.click(screen.getByRole('button', { name: 'Sign In' }))

      // Wait for email validation error to appear
      await waitFor(() => {
        expect(screen.getByText('Invalid email')).toBeInTheDocument()
        expect(screen.getByRole('alert')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    test('should show validation errors for short password', async () => {
      const user = userEvent.setup()

      render(<LoginForm />)

      // Show email form
      await user.click(screen.getByRole('button', { name: /sign in with email/i }))

      // Enter short password
      await user.type(screen.getByLabelText('Email'), 'test@example.com')
      await user.type(screen.getByLabelText('Password'), '123')
      await user.click(screen.getByRole('button', { name: 'Sign In' }))

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument()
      })
    })

    test('should show validation errors for empty fields', async () => {
      const user = userEvent.setup()

      render(<LoginForm />)

      // Show email form
      await user.click(screen.getByRole('button', { name: /sign in with email/i }))

      // Submit empty form
      await user.click(screen.getByRole('button', { name: 'Sign In' }))

      await waitFor(() => {
        expect(screen.getByText('Invalid email')).toBeInTheDocument()
        expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument()
      })
    })
  })

  describe('Status Messages and Accessibility', () => {
    test('should announce status messages to screen readers', async () => {
      const user = userEvent.setup()
      mockSignIn.mockResolvedValue({})

      render(<LoginForm />)

      // Show email form and submit
      await user.click(screen.getByRole('button', { name: /sign in with email/i }))
      await user.type(screen.getByLabelText('Email'), 'test@example.com')
      await user.type(screen.getByLabelText('Password'), 'password123')
      await user.click(screen.getByRole('button', { name: 'Sign In' }))

      // Check screen reader announcement
      const statusElement = screen.getByTestId('login-status-message')
      expect(statusElement).toHaveAttribute('aria-live', 'polite')
      expect(statusElement).toHaveAttribute('aria-atomic', 'true')
    })

    test('should have proper ARIA attributes for form elements', async () => {
      const user = userEvent.setup()

      render(<LoginForm />)

      // Show email form
      await user.click(screen.getByRole('button', { name: /sign in with email/i }))

      const emailInput = screen.getByLabelText('Email')
      const passwordInput = screen.getByLabelText('Password')

      expect(emailInput).toHaveAttribute('aria-required', 'true')
      expect(passwordInput).toHaveAttribute('aria-required', 'true')
      expect(emailInput).toHaveAttribute('type', 'email')
      expect(passwordInput).toHaveAttribute('type', 'password')
    })
  })

  describe('Integration Scenarios', () => {
    test('should disable all buttons during authentication', async () => {
      const user = userEvent.setup()
      mockGoogleSignIn.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      render(<LoginForm />)

      const googleButton = screen.getByRole('button', { name: /continue with google/i })
      const emailButton = screen.getByRole('button', { name: /sign in with email/i })

      await user.click(googleButton)

      // All buttons should be disabled during loading
      expect(googleButton).toBeDisabled()
      expect(emailButton).toBeDisabled()
    })

    test('should handle rapid clicking gracefully', async () => {
      jest.useFakeTimers()

      try {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
        // Make the function take some time to resolve
        mockGoogleSignIn.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

        render(<LoginForm />)

        const googleButton = screen.getByRole('button', { name: /continue with google/i })

        // Click rapidly without awaiting
        user.click(googleButton)
        user.click(googleButton)
        user.click(googleButton)

        // Advance timers to complete the async operations
        jest.runAllTimers()

        // Wait for completion and check only called once
        await waitFor(() => {
          expect(mockGoogleSignIn).toHaveBeenCalledTimes(1)
        }, { timeout: 1000 })
      } finally {
        jest.useRealTimers()
      }
    })
  })

  describe('Link Navigation', () => {
    test('should render forgot password link', async () => {
      const user = userEvent.setup()

      render(<LoginForm />)

      // Show email form
      await user.click(screen.getByRole('button', { name: /sign in with email/i }))

      const forgotPasswordLink = screen.getByRole('link', { name: /reset your password/i })
      expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password')
    })

    test('should render signup link', () => {
      render(<LoginForm />)

      const signupLink = screen.getByRole('link', { name: /create new account/i })
      expect(signupLink).toHaveAttribute('href', '/signup')
    })
  })
})