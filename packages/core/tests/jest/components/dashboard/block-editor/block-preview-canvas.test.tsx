/**
 * @jest-environment jsdom
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'
import { BlockPreviewCanvas } from '@/core/components/dashboard/block-editor/block-preview-canvas'
import type { BlockInstance } from '@/core/types/blocks'

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'canvas.empty.title': 'No blocks yet',
      'canvas.empty.subtitle': 'Add blocks from the sidebar',
      'canvas.editingBadge': 'Editing',
      'canvas.error.blockNotFound': 'Block not found',
    }
    return translations[key] || key
  },
}))

// Mock the testing utils
jest.mock('@/core/lib/test', () => ({
  sel: jest.fn((path: string, params?: Record<string, string>) => {
    const selector = path.split('.').pop() || path
    if (params?.id) {
      return selector.replace('{id}', params.id)
    }
    return selector
  }),
}))

// Mock block loader
jest.mock('@/core/lib/blocks/loader', () => ({
  getBlockComponent: (slug: string) => {
    if (slug === 'unknown-block') return null
    // Return a simple mock component
    return function MockBlock({ title }: any) {
      return <div data-testid={`block-${slug}`}>{title || 'Block Content'}</div>
    }
  },
  normalizeBlockProps: (props: any) => props,
}))

// Mock FloatingBlockToolbar
jest.mock('@/core/components/dashboard/block-editor/floating-block-toolbar', () => ({
  FloatingBlockToolbar: ({ blockId, isVisible, onDuplicate, onRemove }: any) => {
    if (!isVisible) return null
    return (
      <div data-testid={`toolbar-${blockId}`}>
        <button onClick={onDuplicate} data-testid={`duplicate-${blockId}`}>Duplicate</button>
        <button onClick={onRemove} data-testid={`remove-${blockId}`}>Remove</button>
      </div>
    )
  },
}))

describe('BlockPreviewCanvas', () => {
  const mockBlocks: BlockInstance[] = [
    {
      id: 'block-1',
      blockSlug: 'hero-section',
      props: { title: 'Hero Title' },
    },
    {
      id: 'block-2',
      blockSlug: 'content-grid',
      props: { title: 'Grid Title' },
    },
    {
      id: 'block-3',
      blockSlug: 'cta-banner',
      props: { title: 'CTA Title' },
    },
  ]

  const defaultProps = {
    blocks: mockBlocks,
    selectedBlockId: null,
    onSelectBlock: jest.fn(),
    onMoveUp: jest.fn(),
    onMoveDown: jest.fn(),
    onDuplicate: jest.fn(),
    onRemove: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    test('renders empty state when blocks array is empty', () => {
      render(<BlockPreviewCanvas {...defaultProps} blocks={[]} />)

      expect(screen.getByText('No blocks yet')).toBeInTheDocument()
      expect(screen.getByText('Add blocks from the sidebar')).toBeInTheDocument()
    })

    test('renders SelectableBlockPreview for each block', () => {
      render(<BlockPreviewCanvas {...defaultProps} />)

      expect(screen.getByTestId('block-hero-section')).toBeInTheDocument()
      expect(screen.getByTestId('block-content-grid')).toBeInTheDocument()
      expect(screen.getByTestId('block-cta-banner')).toBeInTheDocument()
    })

    test('renders correct number of blocks', () => {
      const { container } = render(<BlockPreviewCanvas {...defaultProps} />)

      const blocks = container.querySelectorAll('[data-cy*="preview-block"]')
      expect(blocks).toHaveLength(3)
    })
  })

  describe('Selection', () => {
    test('passes isSelected=true to selected block', () => {
      const { container } = render(
        <BlockPreviewCanvas {...defaultProps} selectedBlockId="block-2" />
      )

      const selectedBlock = container.querySelector('[data-cy="preview-block-block-2"]')
      expect(selectedBlock).toHaveClass('border-primary')
    })

    test('calls onSelectBlock when block is clicked', () => {
      const onSelectBlock = jest.fn()
      render(<BlockPreviewCanvas {...defaultProps} onSelectBlock={onSelectBlock} />)

      const firstBlock = screen.getByTestId('block-hero-section')
      fireEvent.click(firstBlock)

      expect(onSelectBlock).toHaveBeenCalledWith('block-1')
    })

    test('shows Editing badge when isSelected is true', () => {
      render(<BlockPreviewCanvas {...defaultProps} selectedBlockId="block-1" />)

      expect(screen.getByText('Editing')).toBeInTheDocument()
    })

    test('does not show Editing badge when block is not selected', () => {
      render(<BlockPreviewCanvas {...defaultProps} selectedBlockId={null} />)

      expect(screen.queryByText('Editing')).not.toBeInTheDocument()
    })
  })

  describe('Block Reordering', () => {
    test('calls onMoveUp when up button clicked', () => {
      const onMoveUp = jest.fn()
      const { container } = render(
        <BlockPreviewCanvas {...defaultProps} onMoveUp={onMoveUp} selectedBlockId="block-2" />
      )

      const upButton = container.querySelector('[data-cy="preview-block-moveUp-block-2"]')
      if (upButton) {
        fireEvent.click(upButton)
        expect(onMoveUp).toHaveBeenCalledWith('block-2')
      }
    })

    test('calls onMoveDown when down button clicked', () => {
      const onMoveDown = jest.fn()
      const { container } = render(
        <BlockPreviewCanvas {...defaultProps} onMoveDown={onMoveDown} selectedBlockId="block-2" />
      )

      const downButton = container.querySelector('[data-cy="preview-block-moveDown-block-2"]')
      if (downButton) {
        fireEvent.click(downButton)
        expect(onMoveDown).toHaveBeenCalledWith('block-2')
      }
    })

    test('disables up button for first block', () => {
      const { container } = render(
        <BlockPreviewCanvas {...defaultProps} selectedBlockId="block-1" />
      )

      const upButton = container.querySelector('[data-cy="preview-block-moveUp-block-1"]')
      expect(upButton).toBeDisabled()
    })

    test('disables down button for last block', () => {
      const { container } = render(
        <BlockPreviewCanvas {...defaultProps} selectedBlockId="block-3" />
      )

      const downButton = container.querySelector('[data-cy="preview-block-moveDown-block-3"]')
      expect(downButton).toBeDisabled()
    })

    test('does not disable up button for middle block', () => {
      const { container } = render(
        <BlockPreviewCanvas {...defaultProps} selectedBlockId="block-2" />
      )

      const upButton = container.querySelector('[data-cy="preview-block-moveUp-block-2"]')
      expect(upButton).not.toBeDisabled()
    })

    test('does not disable down button for middle block', () => {
      const { container } = render(
        <BlockPreviewCanvas {...defaultProps} selectedBlockId="block-2" />
      )

      const downButton = container.querySelector('[data-cy="preview-block-moveDown-block-2"]')
      expect(downButton).not.toBeDisabled()
    })
  })

  describe('Floating Toolbar', () => {
    test('shows floating toolbar on hover', () => {
      render(<BlockPreviewCanvas {...defaultProps} />)

      const firstBlock = screen.getByTestId('block-hero-section')
      fireEvent.mouseEnter(firstBlock.parentElement!)

      expect(screen.getByTestId('toolbar-block-1')).toBeInTheDocument()
    })

    test('hides floating toolbar when not hovering', () => {
      render(<BlockPreviewCanvas {...defaultProps} />)

      // Toolbar should not be visible initially
      expect(screen.queryByTestId('toolbar-block-1')).not.toBeInTheDocument()
    })

    test('keeps floating toolbar visible when block is selected', () => {
      render(<BlockPreviewCanvas {...defaultProps} selectedBlockId="block-1" />)

      expect(screen.getByTestId('toolbar-block-1')).toBeInTheDocument()
    })

    test('calls onDuplicate when duplicate button in toolbar clicked', () => {
      const onDuplicate = jest.fn()
      render(<BlockPreviewCanvas {...defaultProps} onDuplicate={onDuplicate} selectedBlockId="block-1" />)

      const duplicateBtn = screen.getByTestId('duplicate-block-1')
      fireEvent.click(duplicateBtn)

      expect(onDuplicate).toHaveBeenCalledWith('block-1')
    })

    test('calls onRemove when remove button in toolbar clicked', () => {
      const onRemove = jest.fn()
      render(<BlockPreviewCanvas {...defaultProps} onRemove={onRemove} selectedBlockId="block-1" />)

      const removeBtn = screen.getByTestId('remove-block-1')
      fireEvent.click(removeBtn)

      expect(onRemove).toHaveBeenCalledWith('block-1')
    })
  })

  describe('Error Handling', () => {
    test('shows error message for unknown block type', () => {
      const blocksWithUnknown: BlockInstance[] = [
        {
          id: 'block-unknown',
          blockSlug: 'unknown-block',
          props: {},
        },
      ]

      render(<BlockPreviewCanvas {...defaultProps} blocks={blocksWithUnknown} />)

      expect(screen.getByText(/Block not found/)).toBeInTheDocument()
      expect(screen.getByText('unknown-block')).toBeInTheDocument()
    })
  })

  describe('Hover States', () => {
    test('applies hover border on mouse enter', () => {
      const { container } = render(<BlockPreviewCanvas {...defaultProps} />)

      const firstBlock = container.querySelector('[data-cy="preview-block-block-1"]')!
      fireEvent.mouseEnter(firstBlock)

      expect(firstBlock).toHaveClass('hover:border-primary/50')
    })

    test('removes hover state on mouse leave', () => {
      render(<BlockPreviewCanvas {...defaultProps} />)

      const firstBlock = screen.getByTestId('block-hero-section').parentElement!

      // Mouse enter
      fireEvent.mouseEnter(firstBlock)
      expect(screen.getByTestId('toolbar-block-1')).toBeInTheDocument()

      // Mouse leave
      fireEvent.mouseLeave(firstBlock)
      expect(screen.queryByTestId('toolbar-block-1')).not.toBeInTheDocument()
    })
  })
})
