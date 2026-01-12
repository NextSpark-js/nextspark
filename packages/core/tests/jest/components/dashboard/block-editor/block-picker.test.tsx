/**
 * @jest-environment jsdom
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'
import { BlockPicker } from '@/core/components/dashboard/block-editor/block-picker'
import type { BlockConfig } from '@/core/types/blocks'

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'sidebar.tabs.blocks': 'Blocks',
      'sidebar.tabs.config': 'Config',
      'sidebar.search.placeholder': 'Search blocks...',
      'sidebar.categories.all': 'All',
      'sidebar.empty': 'No blocks found',
      'sidebar.addBlock': 'Add block',
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

      expect(screen.getByText('All')).toBeInTheDocument()
      expect(screen.getByText('hero')).toBeInTheDocument()
      expect(screen.getByText('content')).toBeInTheDocument()
      expect(screen.getByText('cta')).toBeInTheDocument()
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
    test('filters blocks by selected category', () => {
      render(<BlockPicker {...defaultProps} />)

      const heroCategory = screen.getByText('hero')
      fireEvent.click(heroCategory)

      expect(screen.getByText('Hero Section')).toBeInTheDocument()
      expect(screen.queryByText('Content Grid')).not.toBeInTheDocument()
      expect(screen.queryByText('CTA Banner')).not.toBeInTheDocument()
    })

    test('shows all blocks when All category is selected', () => {
      render(<BlockPicker {...defaultProps} />)

      // First select a category
      const heroCategory = screen.getByText('hero')
      fireEvent.click(heroCategory)

      // Then click All
      const allCategory = screen.getByText('All')
      fireEvent.click(allCategory)

      expect(screen.getByText('Hero Section')).toBeInTheDocument()
      expect(screen.getByText('Content Grid')).toBeInTheDocument()
      expect(screen.getByText('CTA Banner')).toBeInTheDocument()
    })

    test('combines search and category filters', () => {
      render(<BlockPicker {...defaultProps} />)

      // Filter by hero category
      const heroCategory = screen.getByText('hero')
      fireEvent.click(heroCategory)

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
    test('calls onAddBlock when block is clicked', () => {
      const onAddBlock = jest.fn()
      render(<BlockPicker {...defaultProps} onAddBlock={onAddBlock} />)

      const heroBlock = screen.getByText('Hero Section')
      fireEvent.click(heroBlock.closest('[data-cy*="block-picker-card"]')!)

      expect(onAddBlock).toHaveBeenCalledWith('hero-section')
    })

    test('block cards are draggable', () => {
      render(<BlockPicker {...defaultProps} />)

      const heroBlock = screen.getByText('Hero Section').closest('[data-cy*="block-picker-card"]')
      expect(heroBlock).toHaveAttribute('draggable', 'true')
    })

    test('sets correct data on drag start', () => {
      render(<BlockPicker {...defaultProps} />)

      const heroBlock = screen.getByText('Hero Section').closest('[data-cy*="block-picker-card"]')!
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
    test('switches to config tab when clicked', () => {
      render(<BlockPicker {...defaultProps} showFieldsTab={true} />)

      const configTab = screen.getByText('Config')
      fireEvent.click(configTab)

      // Config tab should be active (indicated by specific styling)
      expect(configTab.closest('button')).toHaveClass('text-primary')
    })

    test('does not show config tab when showFieldsTab is false', () => {
      render(<BlockPicker {...defaultProps} showFieldsTab={false} />)

      expect(screen.queryByText('Config')).not.toBeInTheDocument()
    })
  })

  describe('Category Icons and Colors', () => {
    test('applies correct colors to category chips when active', () => {
      render(<BlockPicker {...defaultProps} />)

      const heroCategory = screen.getByText('hero').closest('button')!
      fireEvent.click(heroCategory)

      expect(heroCategory).toHaveClass('bg-indigo-50', 'text-indigo-600', 'border-indigo-200')
    })
  })
})
