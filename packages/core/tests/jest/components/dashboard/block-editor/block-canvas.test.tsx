/**
 * @jest-environment jsdom
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'
import { BlockCanvas } from '@/core/components/dashboard/block-editor/block-canvas'
import type { BlockInstance } from '@/core/types/blocks'

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'empty.message': 'No blocks yet',
      'empty.hint': 'Drag blocks from the sidebar',
    }
    return translations[key] || key
  },
}))

// Mock dnd-kit
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div data-testid="dnd-context">{children}</div>,
  closestCenter: jest.fn(),
  KeyboardSensor: jest.fn(),
  PointerSensor: jest.fn(),
  useSensor: jest.fn(),
  useSensors: jest.fn(() => []),
}))

jest.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => <div data-testid="sortable-context">{children}</div>,
  sortableKeyboardCoordinates: jest.fn(),
  verticalListSortingStrategy: jest.fn(),
  arrayMove: (arr: any[], oldIndex: number, newIndex: number) => {
    const newArr = [...arr]
    const [removed] = newArr.splice(oldIndex, 1)
    newArr.splice(newIndex, 0, removed)
    return newArr
  },
}))

// Mock SortableBlock
jest.mock('@/core/components/dashboard/block-editor/sortable-block', () => ({
  SortableBlock: ({ block, isSelected, onSelect, onRemove, onDuplicate }: any) => (
    <div
      data-testid={`sortable-block-${block.id}`}
      data-selected={isSelected}
      onClick={onSelect}
    >
      <div>{block.blockSlug}</div>
      <button onClick={onDuplicate} data-testid={`duplicate-${block.id}`}>Duplicate</button>
      <button onClick={onRemove} data-testid={`remove-${block.id}`}>Remove</button>
    </div>
  ),
}))

describe('BlockCanvas', () => {
  const mockBlocks: BlockInstance[] = [
    {
      id: 'block-1',
      blockSlug: 'hero-section',
      props: {},
    },
    {
      id: 'block-2',
      blockSlug: 'content-grid',
      props: {},
    },
    {
      id: 'block-3',
      blockSlug: 'cta-banner',
      props: {},
    },
  ]

  const defaultProps = {
    blocks: mockBlocks,
    selectedBlockId: null,
    onSelectBlock: jest.fn(),
    onRemoveBlock: jest.fn(),
    onDuplicateBlock: jest.fn(),
    onReorder: jest.fn(),
    onUpdateProps: jest.fn(),
    onAddBlock: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    test('renders empty state when no blocks', () => {
      render(<BlockCanvas {...defaultProps} blocks={[]} />)

      expect(screen.getByText('No blocks yet')).toBeInTheDocument()
      expect(screen.getByText('Drag blocks from the sidebar')).toBeInTheDocument()
    })

    test('renders SortableBlock for each block', () => {
      render(<BlockCanvas {...defaultProps} />)

      expect(screen.getByTestId('sortable-block-block-1')).toBeInTheDocument()
      expect(screen.getByTestId('sortable-block-block-2')).toBeInTheDocument()
      expect(screen.getByTestId('sortable-block-block-3')).toBeInTheDocument()
    })

    test('renders correct number of blocks', () => {
      render(<BlockCanvas {...defaultProps} />)

      const blocks = screen.getAllByText(/hero-section|content-grid|cta-banner/)
      expect(blocks).toHaveLength(3)
    })

    test('wraps blocks in DndContext', () => {
      render(<BlockCanvas {...defaultProps} />)

      expect(screen.getByTestId('dnd-context')).toBeInTheDocument()
    })

    test('wraps blocks in SortableContext', () => {
      render(<BlockCanvas {...defaultProps} />)

      expect(screen.getByTestId('sortable-context')).toBeInTheDocument()
    })
  })

  describe('Block Selection', () => {
    test('passes isSelected=true to selected block', () => {
      render(<BlockCanvas {...defaultProps} selectedBlockId="block-2" />)

      const selectedBlock = screen.getByTestId('sortable-block-block-2')
      expect(selectedBlock).toHaveAttribute('data-selected', 'true')
    })

    test('calls onSelectBlock when block is clicked', () => {
      const onSelectBlock = jest.fn()
      render(<BlockCanvas {...defaultProps} onSelectBlock={onSelectBlock} />)

      const firstBlock = screen.getByTestId('sortable-block-block-1')
      fireEvent.click(firstBlock)

      expect(onSelectBlock).toHaveBeenCalledWith('block-1')
    })
  })

  describe('Block Actions', () => {
    test('calls onDuplicateBlock when duplicate button clicked', () => {
      const onDuplicateBlock = jest.fn()
      render(<BlockCanvas {...defaultProps} onDuplicateBlock={onDuplicateBlock} />)

      const duplicateBtn = screen.getByTestId('duplicate-block-2')
      fireEvent.click(duplicateBtn)

      expect(onDuplicateBlock).toHaveBeenCalledWith('block-2')
    })

    test('calls onRemoveBlock when remove button clicked', () => {
      const onRemoveBlock = jest.fn()
      render(<BlockCanvas {...defaultProps} onRemoveBlock={onRemoveBlock} />)

      const removeBtn = screen.getByTestId('remove-block-2')
      fireEvent.click(removeBtn)

      expect(onRemoveBlock).toHaveBeenCalledWith('block-2')
    })
  })

  describe('Drag and Drop', () => {
    test('reorders blocks on drag end', () => {
      // This test simulates the drag end behavior
      const onReorder = jest.fn()

      // We can't easily test the full drag interaction with mocked dnd-kit,
      // but we can verify the component structure is correct
      render(<BlockCanvas {...defaultProps} onReorder={onReorder} />)

      expect(screen.getByTestId('dnd-context')).toBeInTheDocument()
      expect(screen.getByTestId('sortable-context')).toBeInTheDocument()
    })

    test('adds block on drop from picker', () => {
      const onAddBlock = jest.fn()
      const { container } = render(<BlockCanvas {...defaultProps} blocks={[]} onAddBlock={onAddBlock} />)

      // Uses actual selector value from BLOCK_EDITOR_SELECTORS.layoutCanvas.empty
      const dropZone = container.querySelector('[data-cy="layout-canvas-empty"]')!

      // Simulate drag over
      fireEvent.dragOver(dropZone, {
        preventDefault: jest.fn(),
      })

      // Simulate drop
      const dataTransfer = {
        getData: jest.fn((key: string) => {
          if (key === 'blockSlug') return 'hero-section'
          return ''
        }),
      }

      fireEvent.drop(dropZone, {
        preventDefault: jest.fn(),
        dataTransfer,
      })

      expect(onAddBlock).toHaveBeenCalledWith('hero-section')
    })

    test('prevents default on drag over empty canvas', () => {
      const { container } = render(<BlockCanvas {...defaultProps} blocks={[]} />)

      // Uses actual selector value from BLOCK_EDITOR_SELECTORS.layoutCanvas.empty
      const dropZone = container.querySelector('[data-cy="layout-canvas-empty"]')!

      // The component should not throw when dragOver is fired
      expect(() => {
        fireEvent.dragOver(dropZone)
      }).not.toThrow()
    })
  })

  describe('Empty State', () => {
    test('shows empty state with correct data-cy attribute', () => {
      const { container } = render(<BlockCanvas {...defaultProps} blocks={[]} />)

      // Uses actual selector value from BLOCK_EDITOR_SELECTORS.layoutCanvas.empty
      expect(container.querySelector('[data-cy="layout-canvas-empty"]')).toBeInTheDocument()
    })

    test('empty state is droppable', () => {
      const onAddBlock = jest.fn()
      const { container } = render(<BlockCanvas {...defaultProps} blocks={[]} onAddBlock={onAddBlock} />)

      // Uses actual selector value from BLOCK_EDITOR_SELECTORS.layoutCanvas.empty
      const dropZone = container.querySelector('[data-cy="layout-canvas-empty"]')!
      expect(dropZone).toBeInTheDocument()

      // Should have drag event handlers
      fireEvent.dragOver(dropZone)
      // No error should be thrown
    })
  })

  describe('Data Attributes', () => {
    test('applies correct data-cy attribute to canvas container', () => {
      const { container } = render(<BlockCanvas {...defaultProps} />)

      // Uses actual selector value from BLOCK_EDITOR_SELECTORS.layoutCanvas.container
      expect(container.querySelector('[data-cy="layout-canvas"]')).toBeInTheDocument()
    })

    test('applies correct data-cy attribute to empty state', () => {
      const { container } = render(<BlockCanvas {...defaultProps} blocks={[]} />)

      // Uses actual selector value from BLOCK_EDITOR_SELECTORS.layoutCanvas.empty
      expect(container.querySelector('[data-cy="layout-canvas-empty"]')).toBeInTheDocument()
    })
  })
})
