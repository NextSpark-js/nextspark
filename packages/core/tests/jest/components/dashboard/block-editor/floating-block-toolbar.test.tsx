/**
 * @jest-environment jsdom
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'
import { FloatingBlockToolbar } from '@/core/components/dashboard/block-editor/floating-block-toolbar'

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      duplicate: 'Duplicate',
      delete: 'Delete',
    }
    return translations[key] || key
  },
}))

// Mock the testing utils - generate predictable selectors for testing
jest.mock('@/core/lib/test', () => ({
  sel: jest.fn((path: string, params?: Record<string, string>) => {
    // Generate selector like: blockEditor-previewCanvas-floatingToolbar-container-{id}
    const basePath = path.replace(/\./g, '-')
    if (params?.id) {
      return `${basePath}-${params.id}`
    }
    return basePath
  }),
}))

// Mock block registry
jest.mock('@nextsparkjs/registries/block-registry', () => ({
  BLOCK_REGISTRY: {
    'hero-section': {
      name: 'Hero Section',
      slug: 'hero-section',
      category: 'hero',
      description: 'Full-width hero section',
    },
    'content-grid': {
      name: 'Content Grid',
      slug: 'content-grid',
      category: 'content',
      description: 'Grid layout for content',
    },
  },
}))

describe('FloatingBlockToolbar', () => {
  const mockProps = {
    blockId: 'block-123',
    blockSlug: 'hero-section',
    isVisible: true,
    onDuplicate: jest.fn(),
    onRemove: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    test('renders block name from registry', () => {
      render(<FloatingBlockToolbar {...mockProps} />)

      expect(screen.getByText('Hero Section')).toBeInTheDocument()
    })

    test('renders duplicate button', () => {
      render(<FloatingBlockToolbar {...mockProps} />)

      const duplicateBtn = screen.getByTitle('Duplicate')
      expect(duplicateBtn).toBeInTheDocument()
    })

    test('renders delete button', () => {
      render(<FloatingBlockToolbar {...mockProps} />)

      const deleteBtn = screen.getByTitle('Delete')
      expect(deleteBtn).toBeInTheDocument()
    })

    test('uses blockSlug as fallback when block not in registry', () => {
      render(
        <FloatingBlockToolbar
          {...mockProps}
          blockSlug="unknown-block"
        />
      )

      expect(screen.getByText('unknown-block')).toBeInTheDocument()
    })
  })

  describe('Interactions', () => {
    test('calls onDuplicate when copy button clicked', () => {
      render(<FloatingBlockToolbar {...mockProps} />)

      const duplicateBtn = screen.getByTitle('Duplicate')
      fireEvent.click(duplicateBtn)

      expect(mockProps.onDuplicate).toHaveBeenCalledTimes(1)
    })

    test('calls onRemove when delete button clicked', () => {
      render(<FloatingBlockToolbar {...mockProps} />)

      const deleteBtn = screen.getByTitle('Delete')
      fireEvent.click(deleteBtn)

      expect(mockProps.onRemove).toHaveBeenCalledTimes(1)
    })

    test('stops event propagation on duplicate click', () => {
      render(<FloatingBlockToolbar {...mockProps} />)

      const duplicateBtn = screen.getByTitle('Duplicate')
      const stopPropagationSpy = jest.fn()

      const event = new MouseEvent('click', { bubbles: true })
      Object.defineProperty(event, 'stopPropagation', {
        value: stopPropagationSpy,
      })

      duplicateBtn.dispatchEvent(event)

      expect(stopPropagationSpy).toHaveBeenCalled()
    })

    test('stops event propagation on remove click', () => {
      render(<FloatingBlockToolbar {...mockProps} />)

      const deleteBtn = screen.getByTitle('Delete')
      const stopPropagationSpy = jest.fn()

      const event = new MouseEvent('click', { bubbles: true })
      Object.defineProperty(event, 'stopPropagation', {
        value: stopPropagationSpy,
      })

      deleteBtn.dispatchEvent(event)

      expect(stopPropagationSpy).toHaveBeenCalled()
    })
  })

  describe('Visibility States', () => {
    test('applies visible classes when isVisible is true', () => {
      const { container } = render(<FloatingBlockToolbar {...mockProps} isVisible={true} />)

      const toolbar = container.querySelector('[data-cy^="blockEditor-previewCanvas-floatingToolbar-container"]')
      expect(toolbar).toHaveClass('opacity-100', 'translate-y-0', 'pointer-events-auto')
    })

    test('applies hidden classes when isVisible is false', () => {
      const { container } = render(<FloatingBlockToolbar {...mockProps} isVisible={false} />)

      const toolbar = container.querySelector('[data-cy^="blockEditor-previewCanvas-floatingToolbar-container"]')
      expect(toolbar).toHaveClass('opacity-0', 'translate-y-2', 'pointer-events-none')
    })
  })

  describe('Styling', () => {
    test('applies correct visual classes', () => {
      const { container } = render(<FloatingBlockToolbar {...mockProps} />)

      const toolbar = container.querySelector('[data-cy^="blockEditor-previewCanvas-floatingToolbar-container"]')
      expect(toolbar).toHaveClass(
        'absolute',
        'bg-primary',
        'text-primary-foreground',
        'rounded-full',
        'shadow-lg'
      )
    })

    test('block name is uppercase', () => {
      render(<FloatingBlockToolbar {...mockProps} />)

      const blockName = screen.getByText('Hero Section')
      expect(blockName).toHaveClass('uppercase', 'tracking-wider')
    })

    test('has smooth transition', () => {
      const { container } = render(<FloatingBlockToolbar {...mockProps} />)

      const toolbar = container.querySelector('[data-cy^="blockEditor-previewCanvas-floatingToolbar-container"]')
      expect(toolbar).toHaveClass('transition-[opacity,transform]', 'duration-200')
    })
  })

  describe('Accessibility', () => {
    test('duplicate button has title attribute', () => {
      render(<FloatingBlockToolbar {...mockProps} />)

      const duplicateBtn = screen.getByTitle('Duplicate')
      expect(duplicateBtn).toHaveAttribute('title', 'Duplicate')
    })

    test('delete button has title attribute', () => {
      render(<FloatingBlockToolbar {...mockProps} />)

      const deleteBtn = screen.getByTitle('Delete')
      expect(deleteBtn).toHaveAttribute('title', 'Delete')
    })
  })

  describe('Different Block Types', () => {
    test('renders correctly for content-grid block', () => {
      render(
        <FloatingBlockToolbar
          {...mockProps}
          blockSlug="content-grid"
        />
      )

      expect(screen.getByText('Content Grid')).toBeInTheDocument()
    })

    test('handles multiple block instances with different IDs', () => {
      const { rerender } = render(<FloatingBlockToolbar {...mockProps} blockId="block-1" />)

      expect(screen.getByText('Hero Section')).toBeInTheDocument()

      rerender(<FloatingBlockToolbar {...mockProps} blockId="block-2" />)

      expect(screen.getByText('Hero Section')).toBeInTheDocument()
    })
  })
})
