/**
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { LastUsedBadge } from '@/core/components/ui/last-used-badge'

// Mock the testing utils
jest.mock('@/core/lib/test', () => ({
  sel: jest.fn((path: string) => path.split('.').pop() || path)
}))

describe('LastUsedBadge Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    test('should render children content correctly', () => {
      render(
        <LastUsedBadge text="Last Used">
          <button>Sign in with Google</button>
        </LastUsedBadge>
      )

      expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument()
    })

    test('should render badge text correctly', () => {
      render(
        <LastUsedBadge text="Last Used">
          <button>Sign in with Google</button>
        </LastUsedBadge>
      )

      expect(screen.getByText('Last Used')).toBeInTheDocument()
    })

    test('should render with custom text', () => {
      const customText = 'Previously Used'
      render(
        <LastUsedBadge text={customText}>
          <button>Test Button</button>
        </LastUsedBadge>
      )

      expect(screen.getByText(customText)).toBeInTheDocument()
    })
  })

  describe('Data Attributes', () => {
    test('should apply custom data-cy attribute to wrapper', () => {
      render(
        <LastUsedBadge text="Last Used" data-cy="custom-badge">
          <button>Test Button</button>
        </LastUsedBadge>
      )

      const wrapper = screen.getByText('Test Button').parentElement!
      expect(wrapper).toHaveAttribute('data-cy', 'custom-badge')
    })

    test('should apply generated data-cy attribute to badge text', () => {
      render(
        <LastUsedBadge text="Last Used">
          <button>Test Button</button>
        </LastUsedBadge>
      )

      const badgeText = screen.getByText('Last Used')
      expect(badgeText).toHaveAttribute('data-cy', 'badge-text')
    })

    test('should work without custom data-cy attribute', () => {
      render(
        <LastUsedBadge text="Last Used">
          <button>Test Button</button>
        </LastUsedBadge>
      )

      expect(screen.getByText('Test Button')).toBeInTheDocument()
      expect(screen.getByText('Last Used')).toBeInTheDocument()
    })
  })

  describe('CSS Classes and Styling', () => {
    test('should apply default wrapper classes', () => {
      render(
        <LastUsedBadge text="Last Used">
          <button>Test Button</button>
        </LastUsedBadge>
      )

      const wrapper = screen.getByText('Test Button').parentElement
      expect(wrapper).toHaveClass('relative')
    })

    test('should apply custom className to wrapper', () => {
      render(
        <LastUsedBadge text="Last Used" className="custom-class">
          <button>Test Button</button>
        </LastUsedBadge>
      )

      const wrapper = screen.getByText('Test Button').parentElement
      expect(wrapper).toHaveClass('relative', 'custom-class')
    })

    test('should apply badge styling classes including animations', () => {
      render(
        <LastUsedBadge text="Last Used">
          <button>Test Button</button>
        </LastUsedBadge>
      )

      const badgeText = screen.getByText('Last Used')
      expect(badgeText).toHaveClass(
        'absolute',
        '-top-2',
        '-right-2',
        'bg-primary',
        'text-primary-foreground',
        'text-xs',
        'font-medium',
        'px-2',
        'py-1',
        'rounded-full',
        'shadow-lg',
        'border-2',
        'border-background',
        'z-10',
        'animate-in',
        'fade-in-0',
        'zoom-in-95',
        'duration-300'
      )
    })
  })

  describe('Accessibility', () => {
    test('should maintain accessibility of children elements', () => {
      render(
        <LastUsedBadge text="Last Used">
          <button aria-label="Sign in with Google">Google</button>
        </LastUsedBadge>
      )

      const button = screen.getByRole('button', { name: 'Sign in with Google' })
      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute('aria-label', 'Sign in with Google')
    })

    test('should not interfere with form controls', () => {
      render(
        <LastUsedBadge text="Last Used">
          <input type="email" placeholder="Enter email" />
        </LastUsedBadge>
      )

      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('type', 'email')
      expect(input).toHaveAttribute('placeholder', 'Enter email')
    })
  })

  describe('Component Structure', () => {
    test('should have correct DOM structure', () => {
      render(
        <LastUsedBadge text="Last Used">
          <button>Test Button</button>
        </LastUsedBadge>
      )

      const wrapper = screen.getByText('Test Button').parentElement
      const badge = screen.getByText('Last Used')

      // Wrapper should contain both the children and the badge
      expect(wrapper).toContainElement(screen.getByText('Test Button'))
      expect(wrapper).toContainElement(badge)

      // Badge should be positioned absolutely
      expect(badge).toHaveClass('absolute')
    })

    test('should render multiple children correctly', () => {
      render(
        <LastUsedBadge text="Last Used">
          <button>Button 1</button>
          <button>Button 2</button>
        </LastUsedBadge>
      )

      expect(screen.getByRole('button', { name: 'Button 1' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Button 2' })).toBeInTheDocument()
      expect(screen.getByText('Last Used')).toBeInTheDocument()
    })
  })

  describe('Integration with Authentication Components', () => {
    test('should work with Google OAuth button and show animations', () => {
      render(
        <LastUsedBadge text="Last Used">
          <button type="button" className="oauth-button">
            <svg>Google Icon</svg>
            Continue with Google
          </button>
        </LastUsedBadge>
      )

      const button = screen.getByRole('button')
      expect(button).toHaveClass('oauth-button')
      expect(screen.getByText('Continue with Google')).toBeInTheDocument()

      const badge = screen.getByText('Last Used')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('animate-in', 'fade-in-0', 'zoom-in-95', 'duration-300')
    })

    test('should work with email form section and maintain animations', () => {
      render(
        <LastUsedBadge text="Last Used">
          <div className="email-form-section">
            <input type="email" placeholder="Email" />
            <button type="submit">Sign In</button>
          </div>
        </LastUsedBadge>
      )

      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()

      const badge = screen.getByText('Last Used')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('animate-in', 'fade-in-0', 'zoom-in-95', 'duration-300')
    })

    test('should enhance UX with smooth visual transitions', () => {
      render(
        <LastUsedBadge text="Last Used">
          <button>Enhanced Button</button>
        </LastUsedBadge>
      )

      const badge = screen.getByText('Last Used')

      // Verify enhanced UX classes are applied
      expect(badge).toHaveClass('duration-300') // Smooth 300ms transition
      expect(badge).toHaveClass('fade-in-0')   // Fade in from transparent
      expect(badge).toHaveClass('zoom-in-95')  // Subtle zoom effect from 95% to 100%
      expect(badge).toHaveClass('animate-in')  // Enable animation framework
    })
  })

  describe('Animation and Visual Effects', () => {
    test('should include smooth animation classes', () => {
      render(
        <LastUsedBadge text="Last Used">
          <button>Test Button</button>
        </LastUsedBadge>
      )

      const badgeText = screen.getByText('Last Used')
      expect(badgeText).toHaveClass('animate-in')
      expect(badgeText).toHaveClass('fade-in-0')
      expect(badgeText).toHaveClass('zoom-in-95')
      expect(badgeText).toHaveClass('duration-300')
    })

    test('should have proper z-index for overlay positioning', () => {
      render(
        <LastUsedBadge text="Last Used">
          <button>Test Button</button>
        </LastUsedBadge>
      )

      const badgeText = screen.getByText('Last Used')
      expect(badgeText).toHaveClass('z-10')
    })

    test('should have shadow and border for visual separation', () => {
      render(
        <LastUsedBadge text="Last Used">
          <button>Test Button</button>
        </LastUsedBadge>
      )

      const badgeText = screen.getByText('Last Used')
      expect(badgeText).toHaveClass('shadow-lg')
      expect(badgeText).toHaveClass('border-2')
      expect(badgeText).toHaveClass('border-background')
    })
  })

  describe('Edge Cases', () => {
    test('should handle empty text gracefully', () => {
      render(
        <LastUsedBadge text="">
          <button>Test Button</button>
        </LastUsedBadge>
      )

      expect(screen.getByText('Test Button')).toBeInTheDocument()
      // Badge element should still exist but be empty
      const badgeElement = screen.getByText('Test Button').parentElement?.querySelector('[data-cy="badge-text"]')
      expect(badgeElement).toBeInTheDocument()
      expect(badgeElement).toHaveTextContent('')
      // Should still have animation classes even with empty text
      expect(badgeElement).toHaveClass('animate-in', 'fade-in-0', 'zoom-in-95', 'duration-300')
    })

    test('should handle special characters in text', () => {
      const specialText = '🎉 Last Used! & #1'
      render(
        <LastUsedBadge text={specialText}>
          <button>Test Button</button>
        </LastUsedBadge>
      )

      expect(screen.getByText(specialText)).toBeInTheDocument()
    })

    test('should handle long text gracefully', () => {
      const longText = 'This is a very long text that might wrap or overflow'
      render(
        <LastUsedBadge text={longText}>
          <button>Test Button</button>
        </LastUsedBadge>
      )

      expect(screen.getByText(longText)).toBeInTheDocument()
    })
  })

  describe('Performance and UX Improvements', () => {
    test('should have optimized animation timing for smooth UX', () => {
      render(
        <LastUsedBadge text="Last Used">
          <button>Test Button</button>
        </LastUsedBadge>
      )

      const badge = screen.getByText('Last Used')

      // 300ms duration provides smooth but quick animation
      expect(badge).toHaveClass('duration-300')

      // Animation should not be too slow or too fast for optimal UX
      expect(badge).not.toHaveClass('duration-100') // Too fast
      expect(badge).not.toHaveClass('duration-500') // Too slow
      expect(badge).not.toHaveClass('duration-1000') // Way too slow
    })

    test('should use subtle zoom effect for professional appearance', () => {
      render(
        <LastUsedBadge text="Last Used">
          <button>Test Button</button>
        </LastUsedBadge>
      )

      const badge = screen.getByText('Last Used')

      // 95% zoom-in provides subtle effect without being distracting
      expect(badge).toHaveClass('zoom-in-95')

      // Should not use dramatic zoom effects
      expect(badge).not.toHaveClass('zoom-in-50') // Too dramatic
      expect(badge).not.toHaveClass('zoom-in-75') // Still too dramatic
    })
  })

  describe('TypeScript Integration', () => {
    test('should accept valid props interface', () => {
      // This test ensures TypeScript compilation succeeds
      const validProps = {
        text: 'Last Used',
        className: 'custom-class',
        'data-cy': 'test-badge',
      }

      render(
        <LastUsedBadge {...validProps}>
          <button>Test</button>
        </LastUsedBadge>
      )

      const badge = screen.getByText('Last Used')
      expect(screen.getByText('Test')).toBeInTheDocument()
      expect(badge).toHaveClass('animate-in', 'fade-in-0', 'zoom-in-95', 'duration-300')
    })
  })
})