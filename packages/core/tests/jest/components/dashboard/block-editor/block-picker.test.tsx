/**
 * @jest-environment jsdom
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'
import { BlockPicker } from '@/core/components/dashboard/block-editor/block-picker'
import type { BlockConfig, BlockInstance } from '@/core/types/blocks'

// Mock TanStack Query
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null, isLoading: false }),
}))

// Mock TreeView since it has complex DnD dependencies
jest.mock('@/core/components/dashboard/block-editor/tree-view', () => ({
  TreeView: ({ emptyMessage }: { emptyMessage?: string }) => (
    <div data-testid="tree-view-mock">{emptyMessage || 'TreeView'}</div>
  ),
}))

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'sidebar.tabs.blocks': 'Blocks',
      'sidebar.tabs.patterns': 'Patterns',
      'sidebar.tabs.layout': 'Layout',
      'sidebar.search.placeholder': 'Search blocks...',
      'sidebar.categories.all': 'All',
      'sidebar.empty': 'No blocks found',
      'sidebar.addBlock': 'Add block',
      'layout.empty': 'No blocks added yet',
    }
    return translations[key] || key
  },
}))

// Mock the testing utils
jest.mock('@/core/lib/test', () => ({
  sel: jest.fn((path: string, params?: Record<string, string>) => {
    const selector = path.split('.').pop() || path
    if (params) {
      return Object.entries(params).reduce((acc, [key, value]) => {
        return acc.replace(`{${key}}`, value)
      }, selector)
    }
    return selector
  }),
}))

// Mock category helpers
jest.mock('@/core/components/dashboard/block-editor/category-helpers', () => ({
  getCategoryConfig: (category: string) => {
    const configs: Record<string, any> = {
      hero: {
        icon: () => null,
        bgColor: 'bg-indigo-50',
        textColor: 'text-indigo-600',
        borderColor: 'border-indigo-200',
      },
      content: {
        icon: () => null,
        bgColor: 'bg-emerald-50',
        textColor: 'text-emerald-600',
        borderColor: 'border-emerald-200',
      },
      cta: {
        icon: () => null,
        bgColor: 'bg-orange-50',
        textColor: 'text-orange-600',
        borderColor: 'border-orange-200',
      },
      default: {
        icon: () => null,
        bgColor: 'bg-slate-50',
        textColor: 'text-slate-600',
        borderColor: 'border-slate-200',
      },
    }
    return configs[category] || configs.default
  },
  getCategoryIcon: (category: string) => () => null,
  getCategoryColors: (category: string) => ({
    bg: 'bg-indigo-50',
    text: 'text-indigo-600',
    border: 'border-indigo-200',
  }),
}))

describe('BlockPicker', () => {
  const mockBlocks: BlockConfig[] = [
    {
      name: 'Hero Section',
      slug: 'hero-section',
      category: 'hero',
      description: 'Full-width hero section with title and CTA',
      scope: ['*'],
      fields: [],
    },
    {
      name: 'Content Grid',
      slug: 'content-grid',
      category: 'content',
      description: 'Grid layout for content blocks',
      scope: ['*'],
      fields: [],
    },
    {
      name: 'CTA Banner',
      slug: 'cta-banner',
      category: 'cta',
      description: 'Call to action banner',
      scope: ['*'],
      fields: [],
    },
  ]

  const mockEntityConfig: any = {
    builder: {
      sidebarFields: [],
    },
    taxonomies: {
      enabled: false,
    },
  }

  const defaultProps = {
    blocks: mockBlocks,
    onAddBlock: jest.fn(),
    entityConfig: mockEntityConfig,
    entityFields: {},
    onEntityFieldChange: jest.fn(),
    showFieldsTab: false,
    showPatternsTab: false,
    // TreeView props for Layout tab
    pageBlocks: [] as BlockInstance[],
    selectedBlockId: null,
    onSelectBlock: jest.fn(),
    onReorderBlocks: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    test('renders all blocks when no filter applied', () => {
      render(<BlockPicker {...defaultProps} />)

      expect(screen.getByText('Hero Section')).toBeInTheDocument()
      expect(screen.getByText('Content Grid')).toBeInTheDocument()
      expect(screen.getByText('CTA Banner')).toBeInTheDocument()
    })

    test('renders blocks tab by default', () => {
      render(<BlockPicker {...defaultProps} />)

      expect(screen.getByText('Blocks')).toBeInTheDocument()
    })

    test('renders search input', () => {
      render(<BlockPicker {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search blocks...')
      expect(searchInput).toBeInTheDocument()
    })

    test('renders category chips', () => {
      render(<BlockPicker {...defaultProps} />)

      // Get the category chips container
      const categoryChips = screen.getByText('All').parentElement!

      expect(screen.getByText('All')).toBeInTheDocument()
      // Use getAllByText since 'hero', 'content', 'cta' appear both in chips and block cards
      expect(categoryChips).toHaveTextContent('hero')
      expect(categoryChips).toHaveTextContent('content')
      expect(categoryChips).toHaveTextContent('cta')
    })
  })

  describe('Search Filtering', () => {
    test('filters blocks by search term (name)', () => {
      render(<BlockPicker {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search blocks...')
      fireEvent.change(searchInput, { target: { value: 'Hero' } })

      expect(screen.getByText('Hero Section')).toBeInTheDocument()
      expect(screen.queryByText('Content Grid')).not.toBeInTheDocument()
      expect(screen.queryByText('CTA Banner')).not.toBeInTheDocument()
    })

    test('filters blocks by search term (description)', () => {
      render(<BlockPicker {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search blocks...')
      fireEvent.change(searchInput, { target: { value: 'Grid layout' } })

      expect(screen.queryByText('Hero Section')).not.toBeInTheDocument()
      expect(screen.getByText('Content Grid')).toBeInTheDocument()
      expect(screen.queryByText('CTA Banner')).not.toBeInTheDocument()
    })

    test('search is case insensitive', () => {
      render(<BlockPicker {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search blocks...')
      fireEvent.change(searchInput, { target: { value: 'HERO' } })

      expect(screen.getByText('Hero Section')).toBeInTheDocument()
    })

    test('shows empty state when no blocks match search', () => {
      render(<BlockPicker {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search blocks...')
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } })

      expect(screen.getByText('No blocks found')).toBeInTheDocument()
    })
  })

  describe('Category Filtering', () => {
    // Helper to get category chip by name (first element with text in the category chips area)
    const getCategoryChip = (container: HTMLElement, name: string) => {
      const allChipsArea = container.querySelector('[data-cy="categoryChips"]')
      if (!allChipsArea) return null
      return Array.from(allChipsArea.querySelectorAll('button')).find(
        btn => btn.textContent?.toLowerCase().includes(name.toLowerCase())
      )
    }

    test('filters blocks by selected category', () => {
      const { container } = render(<BlockPicker {...defaultProps} />)

      // Get the hero category chip (first match in category chips area)
      const heroCategory = getCategoryChip(container, 'hero')
      expect(heroCategory).toBeTruthy()
      fireEvent.click(heroCategory!)

      expect(screen.getByText('Hero Section')).toBeInTheDocument()
      expect(screen.queryByText('Content Grid')).not.toBeInTheDocument()
      expect(screen.queryByText('CTA Banner')).not.toBeInTheDocument()
    })

    test('shows all blocks when All category is selected', () => {
      const { container } = render(<BlockPicker {...defaultProps} />)

      // First select a category
      const heroCategory = getCategoryChip(container, 'hero')
      fireEvent.click(heroCategory!)

      // Then click All
      const allCategory = screen.getByText('All')
      fireEvent.click(allCategory)

      expect(screen.getByText('Hero Section')).toBeInTheDocument()
      expect(screen.getByText('Content Grid')).toBeInTheDocument()
      expect(screen.getByText('CTA Banner')).toBeInTheDocument()
    })

    test('combines search and category filters', () => {
      const { container } = render(<BlockPicker {...defaultProps} />)

      // Filter by hero category
      const heroCategory = getCategoryChip(container, 'hero')
      fireEvent.click(heroCategory!)

      // Add search term
      const searchInput = screen.getByPlaceholderText('Search blocks...')
      fireEvent.change(searchInput, { target: { value: 'Section' } })

      // Should show Hero Section (matches both category and search)
      expect(screen.getByText('Hero Section')).toBeInTheDocument()

      // Should not show other blocks
      expect(screen.queryByText('Content Grid')).not.toBeInTheDocument()
      expect(screen.queryByText('CTA Banner')).not.toBeInTheDocument()
    })
  })

  describe('Block Interactions', () => {
    // Helper to find block card by name
    const getBlockCard = (container: HTMLElement, blockName: string) => {
      const blockList = container.querySelector('[data-cy="blockList"]')
      if (!blockList) return null
      // Find the card that contains the block name
      return Array.from(blockList.querySelectorAll('[draggable="true"]')).find(
        card => card.textContent?.includes(blockName)
      ) as HTMLElement | null
    }

    test('calls onAddBlock when block is clicked', () => {
      const onAddBlock = jest.fn()
      const { container } = render(<BlockPicker {...defaultProps} onAddBlock={onAddBlock} />)

      const heroBlock = getBlockCard(container, 'Hero Section')
      expect(heroBlock).toBeTruthy()
      fireEvent.click(heroBlock!)

      expect(onAddBlock).toHaveBeenCalledWith('hero-section')
    })

    test('block cards are draggable', () => {
      const { container } = render(<BlockPicker {...defaultProps} />)

      const heroBlock = getBlockCard(container, 'Hero Section')
      expect(heroBlock).toHaveAttribute('draggable', 'true')
    })

    test('sets correct data on drag start', () => {
      const { container } = render(<BlockPicker {...defaultProps} />)

      const heroBlock = getBlockCard(container, 'Hero Section')!
      const mockDataTransfer = {
        setData: jest.fn(),
        effectAllowed: '',
      }

      fireEvent.dragStart(heroBlock, {
        dataTransfer: mockDataTransfer,
      })

      expect(mockDataTransfer.setData).toHaveBeenCalledWith('blockSlug', 'hero-section')
      expect(mockDataTransfer.effectAllowed).toBe('copy')
    })
  })

  describe('Tabs', () => {
    test('renders Blocks and Layout tabs', () => {
      render(<BlockPicker {...defaultProps} />)

      expect(screen.getByText('Blocks')).toBeInTheDocument()
      expect(screen.getByText('Layout')).toBeInTheDocument()
    })

    test('switches to layout tab when clicked', () => {
      render(<BlockPicker {...defaultProps} />)

      const layoutTab = screen.getByText('Layout')
      fireEvent.click(layoutTab)

      // Layout tab should be active (indicated by specific styling)
      expect(layoutTab.closest('button')).toHaveClass('text-primary')
      // TreeView should be rendered
      expect(screen.getByTestId('tree-view-mock')).toBeInTheDocument()
    })

    test('shows patterns tab when showPatternsTab is true', () => {
      render(<BlockPicker {...defaultProps} showPatternsTab={true} />)

      expect(screen.getByText('Patterns')).toBeInTheDocument()
    })

    test('does not show patterns tab when showPatternsTab is false', () => {
      render(<BlockPicker {...defaultProps} showPatternsTab={false} />)

      expect(screen.queryByText('Patterns')).not.toBeInTheDocument()
    })
  })

  describe('Category Icons and Colors', () => {
    test('applies correct colors to category chips when active', () => {
      const { container } = render(<BlockPicker {...defaultProps} />)

      // Get the hero category chip from category chips area
      const categoryChipsArea = container.querySelector('[data-cy="categoryChips"]')
      const heroCategory = Array.from(categoryChipsArea!.querySelectorAll('button')).find(
        btn => btn.textContent?.toLowerCase().includes('hero')
      )!
      fireEvent.click(heroCategory)

      expect(heroCategory).toHaveClass('bg-indigo-50', 'text-indigo-600', 'border-indigo-200')
    })
  })
})
