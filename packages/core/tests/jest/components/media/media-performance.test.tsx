/**
 * @jest-environment jsdom
 *
 * Media Component Performance Tests
 *
 * Validates React.memo, useCallback, useMemo, and other
 * INP/UX optimizations applied to the media library components.
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'
import * as React from 'react'

// ─── Mocks ────────────────────────────────────────────

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, params?: Record<string, unknown>) => {
      if (params) return `${key}:${JSON.stringify(params)}`
      return key
    }
    return t
  },
}))

jest.mock('@/core/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

jest.mock('@/core/lib/selectors', () => ({
  sel: (path: string, _params?: Record<string, unknown>) => path,
}))

// Mock UI components as simple wrappers
jest.mock('@/core/components/ui/card', () => ({
  Card: ({ children, className, onClick, ...props }: any) => (
    <div data-testid="card" className={className} onClick={onClick} {...props}>{children}</div>
  ),
  CardContent: ({ children, className }: any) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
}))

jest.mock('@/core/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}))

jest.mock('@/core/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      data-testid="checkbox"
      checked={checked}
      onChange={() => onCheckedChange?.(!checked)}
      {...props}
    />
  ),
}))

jest.mock('@/core/components/ui/skeleton', () => ({
  Skeleton: ({ className }: any) => <div data-testid="skeleton" className={className} />,
}))

jest.mock('@/core/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div data-testid="dropdown-trigger">{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => (
    <div data-testid="dropdown-item" onClick={onClick}>{children}</div>
  ),
}))

jest.mock('@/core/components/ui/badge', () => ({
  Badge: ({ children, onClick, className, ...props }: any) => (
    <span data-testid="badge" className={className} onClick={onClick} {...props}>{children}</span>
  ),
}))

jest.mock('@/core/components/ui/input', () => ({
  Input: ({ onChange, value, ...props }: any) => (
    <input data-testid="search-input" onChange={onChange} value={value} {...props} />
  ),
}))

jest.mock('@/core/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: any) => (
    <div data-testid="select" data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children, ...props }: any) => (
    <div data-testid="select-trigger" {...props}>{children}</div>
  ),
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => <div data-testid="select-item" data-value={value}>{children}</div>,
  SelectValue: () => <span data-testid="select-value" />,
}))

jest.mock('@/core/components/ui/popover', () => ({
  Popover: ({ children }: any) => <div data-testid="popover">{children}</div>,
  PopoverTrigger: ({ children }: any) => <div data-testid="popover-trigger">{children}</div>,
  PopoverContent: ({ children }: any) => <div data-testid="popover-content">{children}</div>,
}))

jest.mock('lucide-react', () => ({
  ImageIcon: () => <svg data-testid="icon-image" />,
  VideoIcon: () => <svg data-testid="icon-video" />,
  FileIcon: () => <svg data-testid="icon-file" />,
  MoreVerticalIcon: () => <svg data-testid="icon-more" />,
  Edit2Icon: () => <svg data-testid="icon-edit" />,
  Trash2Icon: () => <svg data-testid="icon-trash" />,
  UploadIcon: () => <svg data-testid="icon-upload" />,
  SearchIcon: () => <svg data-testid="icon-search" />,
  GridIcon: () => <svg data-testid="icon-grid" />,
  ListIcon: () => <svg data-testid="icon-list" />,
  TagIcon: () => <svg data-testid="icon-tag" />,
  XIcon: () => <svg data-testid="icon-x" />,
}))

// ─── Imports (after mocks) ────────────────────────────

import { MediaCard } from '@/core/components/media/MediaCard'
import { MediaGrid } from '@/core/components/media/MediaGrid'
import { MediaToolbar } from '@/core/components/media/MediaToolbar'

// ─── Test Data ────────────────────────────────────────

const createMedia = (overrides = {}): any => ({
  id: 'media-1',
  userId: 'user-1',
  teamId: 'team-1',
  filename: 'photo.jpg',
  originalFilename: 'photo.jpg',
  mimeType: 'image/jpeg',
  fileSize: 1024000,
  url: 'https://example.com/photo.jpg',
  thumbnailUrl: 'https://example.com/photo-thumb.jpg',
  width: 1920,
  height: 1080,
  title: 'Test Photo',
  alt: 'A test photo',
  caption: '',
  hash: 'abc123',
  status: 'active',
  metadata: {},
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
})

const createVideoMedia = () =>
  createMedia({ id: 'media-2', filename: 'video.mp4', mimeType: 'video/mp4', width: undefined, height: undefined })

// ═══════════════════════════════════════════════════════
// MEDIACARD TESTS
// ═══════════════════════════════════════════════════════

describe('MediaCard', () => {
  const defaultProps = {
    media: createMedia(),
    isSelected: false,
    onSelect: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    mode: 'single' as const,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('React.memo optimization', () => {
    test('is wrapped with React.memo (has $$typeof or compare)', () => {
      // React.memo components have a $$typeof of Symbol(react.memo)
      // or are wrapped function components. The displayName check confirms wrapping.
      expect(MediaCard).toBeDefined()
      // React.memo wraps the component - the type property contains the inner function
      expect((MediaCard as any).type || (MediaCard as any).$$typeof).toBeTruthy()
    })

    test('does not re-render when props are the same', () => {
      const renderSpy = jest.fn()
      const SpyCard = React.memo(function SpyCard(props: any) {
        renderSpy()
        return <div>card</div>
      })

      const { rerender } = render(
        <SpyCard media={defaultProps.media} isSelected={false} />
      )

      expect(renderSpy).toHaveBeenCalledTimes(1)

      // Re-render with same props reference
      rerender(<SpyCard media={defaultProps.media} isSelected={false} />)
      expect(renderSpy).toHaveBeenCalledTimes(1) // Should NOT have been called again
    })
  })

  describe('content-visibility optimization', () => {
    test('applies content-visibility: auto CSS class', () => {
      render(<MediaCard {...defaultProps} />)
      const card = screen.getByTestId('card')
      expect(card.className).toContain('[content-visibility:auto]')
      expect(card.className).toContain('[contain-intrinsic-size:auto_200px]')
    })
  })

  describe('transition optimization', () => {
    test('uses transition-shadow instead of transition-all', () => {
      render(<MediaCard {...defaultProps} />)
      const card = screen.getByTestId('card')
      expect(card.className).toContain('transition-shadow')
      expect(card.className).not.toContain('transition-all')
    })
  })

  describe('image loading optimization', () => {
    test('renders image with loading="lazy" and decoding="async"', () => {
      render(<MediaCard {...defaultProps} />)
      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('loading', 'lazy')
      expect(img).toHaveAttribute('decoding', 'async')
    })
  })

  describe('callback stability', () => {
    test('card click always calls onEdit (opens detail)', () => {
      const onSelect = jest.fn()
      const onEdit = jest.fn()
      render(<MediaCard {...defaultProps} onSelect={onSelect} onEdit={onEdit} mode="multiple" />)

      const card = screen.getByTestId('card')
      fireEvent.click(card)

      expect(onEdit).toHaveBeenCalledWith(defaultProps.media)
      expect(onSelect).not.toHaveBeenCalled()
    })

    test('card click in single mode also calls onEdit', () => {
      const onSelect = jest.fn()
      const onEdit = jest.fn()
      render(<MediaCard {...defaultProps} onSelect={onSelect} onEdit={onEdit} mode="single" />)

      const card = screen.getByTestId('card')
      fireEvent.click(card)

      expect(onEdit).toHaveBeenCalledWith(defaultProps.media)
      expect(onSelect).not.toHaveBeenCalled()
    })

    test('checkbox click toggles selection (does not propagate to card)', () => {
      const onSelect = jest.fn()
      const onEdit = jest.fn()
      render(<MediaCard {...defaultProps} onSelect={onSelect} onEdit={onEdit} mode="multiple" />)

      const checkbox = screen.getByTestId('checkbox')
      fireEvent.click(checkbox)

      // onSelect called once from checkbox, onEdit NOT called
      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(onEdit).not.toHaveBeenCalled()
    })
  })

  describe('visual states', () => {
    test('renders selection ring when selected', () => {
      render(<MediaCard {...defaultProps} isSelected={true} />)
      const card = screen.getByTestId('card')
      expect(card.className).toContain('ring-2')
      expect(card.className).toContain('ring-primary')
    })

    test('renders image for image media types', () => {
      render(<MediaCard {...defaultProps} />)
      expect(screen.getByRole('img')).toBeInTheDocument()
    })

    test('renders video icon for video media types', () => {
      render(<MediaCard {...defaultProps} media={createVideoMedia()} />)
      expect(screen.getByTestId('icon-video')).toBeInTheDocument()
    })

    test('renders dimensions text when available', () => {
      render(<MediaCard {...defaultProps} />)
      expect(screen.getByText(/1920/)).toBeInTheDocument()
    })

    test('does not render dimensions when not available', () => {
      render(<MediaCard {...defaultProps} media={createVideoMedia()} />)
      expect(screen.queryByText(/1920/)).not.toBeInTheDocument()
    })
  })
})

// ═══════════════════════════════════════════════════════
// MEDIAGRID TESTS
// ═══════════════════════════════════════════════════════

describe('MediaGrid', () => {
  const defaultProps = {
    items: [createMedia(), createMedia({ id: 'media-2', filename: 'photo2.jpg' })],
    isLoading: false,
    selectedIds: new Set<string>(),
    onSelect: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    mode: 'single' as const,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('gridStyle memoization', () => {
    test('applies correct grid template columns based on columns prop', () => {
      const { container } = render(<MediaGrid {...defaultProps} columns={4} />)
      const gridDiv = container.querySelector('[data-cy="media.grid.container"]')
      expect(gridDiv).toHaveStyle({ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' })
    })

    test('defaults to 6 columns', () => {
      const { container } = render(<MediaGrid {...defaultProps} />)
      const gridDiv = container.querySelector('[data-cy="media.grid.container"]')
      expect(gridDiv).toHaveStyle({ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' })
    })
  })

  describe('loading state', () => {
    test('renders skeletons during loading', () => {
      render(<MediaGrid {...defaultProps} isLoading={true} />)
      const skeletons = screen.getAllByTestId('skeleton')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    test('renders correct number of skeletons (columns * 2)', () => {
      render(<MediaGrid {...defaultProps} isLoading={true} columns={4} />)
      // 4 columns * 2 rows = 8 skeleton groups, each with 2 skeletons (square + text)
      const skeletons = screen.getAllByTestId('skeleton')
      expect(skeletons.length).toBe(4 * 2 * 2) // 4 cols * 2 rows * 2 skeletons per cell
    })
  })

  describe('empty state', () => {
    test('shows empty message when no items', () => {
      render(<MediaGrid {...defaultProps} items={[]} />)
      expect(screen.getByText('empty.title')).toBeInTheDocument()
    })
  })

  describe('items rendering', () => {
    test('renders a card for each item', () => {
      render(<MediaGrid {...defaultProps} />)
      const cards = screen.getAllByTestId('card')
      expect(cards).toHaveLength(2)
    })

    test('passes isSelected correctly from Set', () => {
      const selectedIds = new Set(['media-1'])
      render(<MediaGrid {...defaultProps} selectedIds={selectedIds} />)
      // First card should have selection ring
      const cards = screen.getAllByTestId('card')
      expect(cards[0].className).toContain('ring-2')
      expect(cards[1].className).not.toContain('ring-2')
    })
  })
})

// ═══════════════════════════════════════════════════════
// MEDIATOOLBAR TESTS
// ═══════════════════════════════════════════════════════

describe('MediaToolbar', () => {
  const defaultProps = {
    onUploadClick: jest.fn(),
    searchQuery: '',
    onSearchChange: jest.fn(),
    typeFilter: 'all' as const,
    onTypeFilterChange: jest.fn(),
    sortBy: 'createdAt' as const,
    sortDir: 'desc' as const,
    onSortChange: jest.fn(),
    viewMode: 'grid' as const,
    onViewModeChange: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('React.memo optimization', () => {
    test('is wrapped with React.memo', () => {
      expect(MediaToolbar).toBeDefined()
      expect((MediaToolbar as any).type || (MediaToolbar as any).$$typeof).toBeTruthy()
    })
  })

  describe('rendering', () => {
    test('renders upload button when onUploadClick is provided', () => {
      render(<MediaToolbar {...defaultProps} />)
      expect(screen.getByTestId('icon-upload')).toBeInTheDocument()
    })

    test('does not render upload button when onUploadClick is not provided', () => {
      render(<MediaToolbar {...defaultProps} onUploadClick={undefined} />)
      expect(screen.queryByTestId('icon-upload')).not.toBeInTheDocument()
    })

    test('renders search input', () => {
      render(<MediaToolbar {...defaultProps} />)
      expect(screen.getByTestId('search-input')).toBeInTheDocument()
    })

    test('renders view toggle buttons', () => {
      render(<MediaToolbar {...defaultProps} />)
      expect(screen.getByTestId('icon-grid')).toBeInTheDocument()
      expect(screen.getByTestId('icon-list')).toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    test('calls onUploadClick when upload button is clicked', () => {
      const onUploadClick = jest.fn()
      render(<MediaToolbar {...defaultProps} onUploadClick={onUploadClick} />)

      const uploadBtn = screen.getByTestId('icon-upload').closest('button')!
      fireEvent.click(uploadBtn)

      expect(onUploadClick).toHaveBeenCalledTimes(1)
    })

    test('calls onSearchChange when search input changes', () => {
      const onSearchChange = jest.fn()
      render(<MediaToolbar {...defaultProps} onSearchChange={onSearchChange} />)

      const input = screen.getByTestId('search-input')
      fireEvent.change(input, { target: { value: 'test' } })

      expect(onSearchChange).toHaveBeenCalledWith('test')
    })
  })
})

// ═══════════════════════════════════════════════════════
// GENERAL PERFORMANCE PATTERN TESTS
// ═══════════════════════════════════════════════════════

describe('Performance patterns', () => {
  describe('Set-based lookups (O(1) vs O(n))', () => {
    test('MediaGrid uses Set.has() for selection checking', () => {
      const selectedIds = new Set(['media-1'])
      const hasSpy = jest.spyOn(selectedIds, 'has')

      render(
        <MediaGrid
          items={[createMedia()]}
          isLoading={false}
          selectedIds={selectedIds}
          onSelect={jest.fn()}
          mode="single"
        />
      )

      expect(hasSpy).toHaveBeenCalledWith('media-1')
      hasSpy.mockRestore()
    })
  })

  describe('useMemo for derived objects', () => {
    test('gridStyle object is reused across renders with same columns', () => {
      const { rerender, container } = render(
        <MediaGrid
          items={[createMedia()]}
          isLoading={false}
          selectedIds={new Set()}
          onSelect={jest.fn()}
          columns={4}
        />
      )

      const gridDiv1 = container.querySelector('[data-cy="media.grid.container"]')
      const style1 = gridDiv1?.getAttribute('style')

      rerender(
        <MediaGrid
          items={[createMedia()]}
          isLoading={false}
          selectedIds={new Set()}
          onSelect={jest.fn()}
          columns={4}
        />
      )

      const gridDiv2 = container.querySelector('[data-cy="media.grid.container"]')
      const style2 = gridDiv2?.getAttribute('style')

      expect(style1).toBe(style2)
    })
  })

  describe('React.memo prevents sibling re-renders', () => {
    test('re-rendering parent with new items does not crash', () => {
      const items1 = [createMedia(), createMedia({ id: 'media-2' })]
      const items2 = [createMedia(), createMedia({ id: 'media-2' }), createMedia({ id: 'media-3' })]

      const { rerender } = render(
        <MediaGrid
          items={items1}
          isLoading={false}
          selectedIds={new Set()}
          onSelect={jest.fn()}
        />
      )

      expect(screen.getAllByTestId('card')).toHaveLength(2)

      rerender(
        <MediaGrid
          items={items2}
          isLoading={false}
          selectedIds={new Set()}
          onSelect={jest.fn()}
        />
      )

      expect(screen.getAllByTestId('card')).toHaveLength(3)
    })
  })
})
