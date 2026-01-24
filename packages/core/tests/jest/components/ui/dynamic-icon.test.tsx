/**
 * @jest-environment jsdom
 */

import { describe, test, expect, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { DynamicIcon } from '@/core/components/ui/dynamic-icon'

// Mock lucide-react icons module
jest.mock('lucide-react', () => {
  const mockIcon = (name: string) => {
    const Icon = ({ className }: { className?: string }) => (
      <svg data-testid={`icon-${name}`} className={className} />
    )
    Icon.displayName = name
    return Icon
  }

  return {
    icons: {
      LayoutGrid: mockIcon('LayoutGrid'),
      Home: mockIcon('Home'),
      Search: mockIcon('Search'),
      Settings: mockIcon('Settings'),
    },
  }
})

describe('DynamicIcon', () => {
  describe('Rendering', () => {
    test('renders icon by name', () => {
      render(<DynamicIcon name="Home" />)
      expect(screen.getByTestId('icon-Home')).toBeInTheDocument()
    })

    test('applies default className', () => {
      render(<DynamicIcon name="Home" />)
      const icon = screen.getByTestId('icon-Home')
      expect(icon).toHaveClass('h-4', 'w-4')
    })

    test('applies custom className', () => {
      render(<DynamicIcon name="Home" className="h-6 w-6 text-red-500" />)
      const icon = screen.getByTestId('icon-Home')
      expect(icon).toHaveClass('h-6', 'w-6', 'text-red-500')
    })
  })

  describe('Fallback Behavior', () => {
    test('falls back to LayoutGrid when icon name is not found', () => {
      render(<DynamicIcon name="NonExistentIcon" />)
      expect(screen.getByTestId('icon-LayoutGrid')).toBeInTheDocument()
    })

    test('uses custom fallback when specified', () => {
      render(<DynamicIcon name="NonExistentIcon" fallback="Settings" />)
      expect(screen.getByTestId('icon-Settings')).toBeInTheDocument()
    })
  })
})
