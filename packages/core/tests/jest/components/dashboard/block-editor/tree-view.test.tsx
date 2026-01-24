/**
 * @jest-environment jsdom
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'
import { TreeView } from '@/core/components/dashboard/block-editor/tree-view'
import type { BlockInstance } from '@/core/types/blocks'

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'layout.empty': 'No blocks added yet',
    }
    return translations[key] || key
  },
}))

// Mock the testing utils
jest.mock('@/core/lib/test', () => ({
  sel: jest.fn((path: string) => path.split('.').pop() || path),
}))

// Mock DnD Kit - minimal mock for testing
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: jest.fn(),
  KeyboardSensor: jest.fn(),
  PointerSensor: jest.fn(),
  useSensor: jest.fn(),
  useSensors: jest.fn(() => []),
}))

jest.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  sortableKeyboardCoordinates: jest.fn(),
  verticalListSortingStrategy: {},
  useSortable: jest.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
}))

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  LayoutList: () => <svg data-testid="layout-list-icon" />,
  GripVertical: () => <svg data-testid="grip-icon" />,
  Layers: () => <svg data-testid="layers-icon" />,
  LayoutGrid: () => <svg data-testid="layout-grid-icon" />,
}))

// Mock TreeViewNode
jest.mock('@/core/components/dashboard/block-editor/tree-view-node', () => ({
  TreeViewNode: ({ block, isSelected, onSelect }: any) => (
    <div
      data-testid={`tree-node-${block.id}`}
      data-selected={isSelected}
      onClick={onSelect}
    >
      {block.blockSlug || block.ref}
    </div>
  ),
}))

// Mock pattern-reference utils
jest.mock('@/core/types/pattern-reference', () => ({
  isPatternReference: (block: any) => 'ref' in block,
}))

describe('TreeView', () => {
  const mockBlocks: BlockInstance[] = [
    {
      id: 'block-1',
      blockSlug: 'hero-section',
      settings: {},
    },
    {
      id: 'block-2',
      blockSlug: 'content-grid',
      settings: {},
    },
    {
      id: 'block-3',
      blockSlug: 'cta-banner',
      settings: {},
    },
  ]

  const defaultProps = {
    blocks: mockBlocks,
    selectedBlockId: null,
    onSelectBlock: jest.fn(),
    onReorder: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    test('renders all blocks as tree nodes', () => {
      render(<TreeView {...defaultProps} />)

      expect(screen.getByTestId('tree-node-block-1')).toBeInTheDocument()
      expect(screen.getByTestId('tree-node-block-2')).toBeInTheDocument()
      expect(screen.getByTestId('tree-node-block-3')).toBeInTheDocument()
    })

    test('renders empty state when no blocks', () => {
      render(<TreeView {...defaultProps} blocks={[]} />)

      expect(screen.getByText('No blocks added yet')).toBeInTheDocument()
    })

    test('renders custom empty message', () => {
      render(<TreeView {...defaultProps} blocks={[]} emptyMessage="Add blocks to get started" />)

      expect(screen.getByText('Add blocks to get started')).toBeInTheDocument()
    })

    test('marks selected block correctly', () => {
      render(<TreeView {...defaultProps} selectedBlockId="block-2" />)

      const selectedNode = screen.getByTestId('tree-node-block-2')
      expect(selectedNode).toHaveAttribute('data-selected', 'true')
    })
  })

  describe('Interactions', () => {
    test('calls onSelectBlock when a block is clicked', () => {
      const onSelectBlock = jest.fn()
      render(<TreeView {...defaultProps} onSelectBlock={onSelectBlock} />)

      const block1 = screen.getByTestId('tree-node-block-1')
      fireEvent.click(block1)

      expect(onSelectBlock).toHaveBeenCalledWith('block-1')
    })
  })
})
