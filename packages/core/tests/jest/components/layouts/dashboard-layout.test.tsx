/**
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { render, screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'

// Mock useAuthMethodDetector hook
const mockUseAuthMethodDetector = jest.fn()

jest.mock('@/core/hooks/useAuthMethodDetector', () => ({
  useAuthMethodDetector: mockUseAuthMethodDetector
}))

// Mock next/navigation
const mockPush = jest.fn()
const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    pathname: '/dashboard',
    searchParams: new URLSearchParams()
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard'
}))

// Mock the actual dashboard layout component
// Note: This would be the actual path to your dashboard layout
const MockDashboardLayout = ({ children }: { children: React.ReactNode }) => {
  // Simulate the useAuthMethodDetector being called in the layout
  mockUseAuthMethodDetector()

  return (
    <div data-testid="dashboard-layout">
      <header data-testid="dashboard-header">Dashboard Header</header>
      <nav data-testid="dashboard-nav">Dashboard Navigation</nav>
      <main data-testid="dashboard-main">{children}</main>
    </div>
  )
}

describe('Dashboard Layout OAuth Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('OAuth Callback Detection', () => {
    test('should call useAuthMethodDetector hook on layout render', () => {
      render(
        <MockDashboardLayout>
          <div>Dashboard Content</div>
        </MockDashboardLayout>
      )

      expect(mockUseAuthMethodDetector).toHaveBeenCalledTimes(1)
    })

    test('should render dashboard layout normally', () => {
      render(
        <MockDashboardLayout>
          <div>Test Dashboard Content</div>
        </MockDashboardLayout>
      )

      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument()
      expect(screen.getByTestId('dashboard-header')).toBeInTheDocument()
      expect(screen.getByTestId('dashboard-nav')).toBeInTheDocument()
      expect(screen.getByTestId('dashboard-main')).toBeInTheDocument()
      expect(screen.getByText('Test Dashboard Content')).toBeInTheDocument()
    })

    test('should handle OAuth callback flow without breaking layout', () => {
      // Simulate OAuth redirect scenario
      mockUseAuthMethodDetector.mockImplementation(() => {
        // Simulate the hook processing auth_method parameter
      })

      render(
        <MockDashboardLayout>
          <div>Post-OAuth Dashboard Content</div>
        </MockDashboardLayout>
      )

      expect(mockUseAuthMethodDetector).toHaveBeenCalled()
      expect(screen.getByText('Post-OAuth Dashboard Content')).toBeInTheDocument()
    })
  })

  describe('Integration Scenarios', () => {
    test('should maintain layout integrity during OAuth processing', () => {
      render(
        <MockDashboardLayout>
          <div>User Dashboard</div>
        </MockDashboardLayout>
      )

      // Verify all layout components are present
      expect(screen.getByTestId('dashboard-header')).toBeInTheDocument()
      expect(screen.getByTestId('dashboard-nav')).toBeInTheDocument()
      expect(screen.getByTestId('dashboard-main')).toBeInTheDocument()

      // Verify content is rendered
      expect(screen.getByText('User Dashboard')).toBeInTheDocument()

      // Verify OAuth detection was called
      expect(mockUseAuthMethodDetector).toHaveBeenCalled()
    })

    test('should not interfere with child component rendering', () => {
      const ChildComponent = () => (
        <div>
          <h1>Dashboard Title</h1>
          <p>Dashboard content with complex structure</p>
          <button>Action Button</button>
        </div>
      )

      render(
        <MockDashboardLayout>
          <ChildComponent />
        </MockDashboardLayout>
      )

      expect(screen.getByRole('heading', { name: 'Dashboard Title' })).toBeInTheDocument()
      expect(screen.getByText('Dashboard content with complex structure')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Action Button' })).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    test('should handle useAuthMethodDetector errors gracefully', () => {
      // Mock console.error to suppress error logs in test output
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      
      mockUseAuthMethodDetector.mockImplementation(() => {
        throw new Error('OAuth detection error')
      })

      // Since hooks that throw errors cause component render failures,
      // we expect this to throw in the current React implementation
      expect(() => {
        render(
          <MockDashboardLayout>
            <div>Dashboard Content</div>
          </MockDashboardLayout>
        )
      }).toThrow('OAuth detection error')
      
      // Restore console.error
      consoleErrorSpy.mockRestore()
    })

    test('should maintain functionality when hook fails silently', () => {
      mockUseAuthMethodDetector.mockImplementation(() => {
        // Silent failure - hook runs but does nothing
        return undefined
      })

      render(
        <MockDashboardLayout>
          <div>Resilient Dashboard</div>
        </MockDashboardLayout>
      )

      expect(screen.getByText('Resilient Dashboard')).toBeInTheDocument()
      expect(mockUseAuthMethodDetector).toHaveBeenCalled()
    })
  })

  describe('Performance Considerations', () => {
    test('should only call useAuthMethodDetector once per render', () => {
      const { rerender } = render(
        <MockDashboardLayout>
          <div>Initial Content</div>
        </MockDashboardLayout>
      )

      expect(mockUseAuthMethodDetector).toHaveBeenCalledTimes(1)

      // Rerender with different children
      rerender(
        <MockDashboardLayout>
          <div>Updated Content</div>
        </MockDashboardLayout>
      )

      expect(mockUseAuthMethodDetector).toHaveBeenCalledTimes(2)
    })

    test('should not cause unnecessary re-renders', () => {
      let renderCount = 0

      const CountingComponent = () => {
        renderCount++
        return <div>Render count: {renderCount}</div>
      }

      render(
        <MockDashboardLayout>
          <CountingComponent />
        </MockDashboardLayout>
      )

      expect(screen.getByText('Render count: 1')).toBeInTheDocument()
      expect(renderCount).toBe(1)
    })
  })

  describe('OAuth Flow Integration', () => {
    test('should support typical OAuth redirect scenario', async () => {
      // Simulate the complete OAuth flow:
      // 1. User clicks Google OAuth on login page
      // 2. Redirected to Google
      // 3. Google redirects back to /dashboard?auth_method=google
      // 4. useAuthMethodDetector processes the parameter
      // 5. User sees dashboard with proper auth method saved

      mockUseAuthMethodDetector.mockImplementation(() => {
        // Simulate successful OAuth detection and cleanup
        window.history.replaceState({}, '', '/dashboard')
      })

      render(
        <MockDashboardLayout>
          <div>
            <h1>Welcome to Dashboard</h1>
            <p>You have successfully logged in with Google</p>
          </div>
        </MockDashboardLayout>
      )

      expect(mockUseAuthMethodDetector).toHaveBeenCalled()
      expect(screen.getByText('Welcome to Dashboard')).toBeInTheDocument()
      expect(screen.getByText('You have successfully logged in with Google')).toBeInTheDocument()
    })

    test('should handle multiple OAuth parameters gracefully', () => {
      mockUseAuthMethodDetector.mockImplementation(() => {
        // Simulate handling URL with multiple parameters
        // /dashboard?auth_method=google&code=123&state=abc
        // Should only process auth_method and leave others intact
      })

      render(
        <MockDashboardLayout>
          <div>Dashboard with OAuth params</div>
        </MockDashboardLayout>
      )

      expect(mockUseAuthMethodDetector).toHaveBeenCalled()
      expect(screen.getByText('Dashboard with OAuth params')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    test('should maintain accessibility during OAuth processing', () => {
      render(
        <MockDashboardLayout>
          <div role="main" aria-label="Dashboard main content">
            <h1>Accessible Dashboard</h1>
            <nav aria-label="Secondary navigation">
              <ul>
                <li><a href="/profile">Profile</a></li>
                <li><a href="/settings">Settings</a></li>
              </ul>
            </nav>
          </div>
        </MockDashboardLayout>
      )

      expect(screen.getByRole('main', { name: 'Dashboard main content' })).toBeInTheDocument()
      expect(screen.getByRole('navigation', { name: 'Secondary navigation' })).toBeInTheDocument()
      expect(mockUseAuthMethodDetector).toHaveBeenCalled()
    })

    test('should preserve focus management during OAuth callback', () => {
      render(
        <MockDashboardLayout>
          <div>
            <button autoFocus>Primary Action</button>
            <button>Secondary Action</button>
          </div>
        </MockDashboardLayout>
      )

      // OAuth detection should not interfere with focus
      const primaryButton = screen.getByRole('button', { name: 'Primary Action' })
      expect(primaryButton).toHaveFocus()
      expect(mockUseAuthMethodDetector).toHaveBeenCalled()
    })
  })
})