/**
 * @jest-environment jsdom
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'
import { ViewportToggle, MOBILE_VIEWPORT_WIDTH } from '@/core/components/dashboard/block-editor/viewport-toggle'

// Mock the testing utils
jest.mock('@/core/lib/test', () => ({
  sel: jest.fn((path: string) => path.split('.').pop() || path),
}))

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Monitor: () => <svg data-testid="monitor-icon" />,
  Smartphone: () => <svg data-testid="smartphone-icon" />,
}))

describe('ViewportToggle', () => {
  const defaultProps = {
    value: 'desktop' as const,
    onChange: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    test('renders mobile and desktop buttons', () => {
      render(<ViewportToggle {...defaultProps} />)

      expect(screen.getByTestId('smartphone-icon')).toBeInTheDocument()
      expect(screen.getByTestId('monitor-icon')).toBeInTheDocument()
    })

    test('highlights desktop button when value is desktop', () => {
      render(<ViewportToggle {...defaultProps} value="desktop" />)

      const desktopButton = screen.getByTestId('monitor-icon').closest('button')
      // Active state uses bg-background shadow-sm
      expect(desktopButton).toHaveClass('bg-background', 'shadow-sm')
    })

    test('highlights mobile button when value is mobile', () => {
      render(<ViewportToggle {...defaultProps} value="mobile" />)

      const mobileButton = screen.getByTestId('smartphone-icon').closest('button')
      // Active state uses bg-background shadow-sm
      expect(mobileButton).toHaveClass('bg-background', 'shadow-sm')
    })
  })

  describe('Interactions', () => {
    test('calls onChange with mobile when mobile button is clicked', () => {
      const onChange = jest.fn()
      render(<ViewportToggle {...defaultProps} value="desktop" onChange={onChange} />)

      const mobileButton = screen.getByTestId('smartphone-icon').closest('button')!
      fireEvent.click(mobileButton)

      expect(onChange).toHaveBeenCalledWith('mobile')
    })

    test('calls onChange with desktop when desktop button is clicked', () => {
      const onChange = jest.fn()
      render(<ViewportToggle {...defaultProps} value="mobile" onChange={onChange} />)

      const desktopButton = screen.getByTestId('monitor-icon').closest('button')!
      fireEvent.click(desktopButton)

      expect(onChange).toHaveBeenCalledWith('desktop')
    })
  })

  describe('Constants', () => {
    test('exports MOBILE_VIEWPORT_WIDTH as 375', () => {
      expect(MOBILE_VIEWPORT_WIDTH).toBe(375)
    })
  })
})
