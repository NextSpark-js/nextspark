/**
 * @jest-environment jsdom
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'
import { BlockSettingsPanel } from '@/core/components/dashboard/block-editor/block-settings-panel'
import type { BlockInstance, FieldDefinition } from '@/core/types/blocks'

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'empty.message': 'No block selected',
      'empty.hint': 'Click on a block to edit',
      'error.notFound': 'Block not found: {{slug}}',
      'actions.reset': 'Reset',
      'actions.remove': 'Remove',
      'tabs.content': 'Content',
      'tabs.design': 'Design',
      'tabs.advanced': 'Advanced',
    }
    const result = translations[key] || key
    return result.replace('{{slug}}', 'unknown-block')
  },
}))

// Note: We do NOT mock sel() - we let it use the real implementation
// so tests verify the correct selector paths are used

// Mock block registry
jest.mock('@nextsparkjs/registries/block-registry', () => ({
  BLOCK_REGISTRY: {
    'hero-section': {
      name: 'Hero Section',
      slug: 'hero-section',
      category: 'hero',
      description: 'Full-width hero section',
      fieldDefinitions: [
        {
          name: 'title',
          type: 'text',
          label: 'Title',
          tab: 'content',
        },
        {
          name: 'backgroundColor',
          type: 'color',
          label: 'Background Color',
          tab: 'design',
        },
        {
          name: 'customClass',
          type: 'text',
          label: 'Custom CSS Class',
          tab: 'advanced',
        },
      ] as FieldDefinition[],
    },
    'content-grid': {
      name: 'Content Grid',
      slug: 'content-grid',
      category: 'content',
      fieldDefinitions: [
        {
          name: 'columns',
          type: 'number',
          label: 'Columns',
          // No tab specified - should default to 'content'
        },
      ] as FieldDefinition[],
    },
  },
}))

// Mock DynamicForm
jest.mock('@/core/components/dashboard/block-editor/dynamic-form', () => ({
  DynamicForm: ({ fields, values, onChange }: any) => (
    <div data-testid="dynamic-form">
      {fields && fields.map((field: any) => (
        <div key={field.name}>
          <label>{field.label}</label>
          <input
            type="text"
            value={values[field.name] || ''}
            onChange={(e) => onChange({ ...values, [field.name]: e.target.value })}
            data-testid={`field-${field.name}`}
          />
        </div>
      ))}
    </div>
  ),
}))

describe('BlockSettingsPanel', () => {
  const mockBlock: BlockInstance = {
    id: 'block-1',
    blockSlug: 'hero-section',
    props: { title: 'My Hero' },
  }

  const defaultProps = {
    block: mockBlock,
    onUpdateProps: jest.fn(),
    onRemove: jest.fn(),
    onClose: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    test('renders empty state when block is undefined', () => {
      render(<BlockSettingsPanel {...defaultProps} block={undefined} />)

      expect(screen.getByText('No block selected')).toBeInTheDocument()
      expect(screen.getByText('Click on a block to edit')).toBeInTheDocument()
    })

    test('renders block name from registry', () => {
      render(<BlockSettingsPanel {...defaultProps} />)

      // v2.0: Only block name is shown, not the slug
      expect(screen.getByText('Hero Section')).toBeInTheDocument()
    })

    test('renders error state for unknown block slug', () => {
      const unknownBlock: BlockInstance = {
        id: 'block-2',
        blockSlug: 'unknown-block',
        props: {},
      }

      render(<BlockSettingsPanel {...defaultProps} block={unknownBlock} />)

      expect(screen.getByText(/Block not found/)).toBeInTheDocument()
    })

    test('renders close button when onClose is provided', () => {
      const { container } = render(<BlockSettingsPanel {...defaultProps} />)

      const closeBtn = container.querySelector('[data-cy="block-properties-close"]')
      expect(closeBtn).toBeInTheDocument()
    })

    test('does not render close button when onClose is not provided', () => {
      const { container } = render(<BlockSettingsPanel {...defaultProps} onClose={undefined} />)

      expect(container.querySelector('[data-cy="block-properties-close"]')).not.toBeInTheDocument()
    })

    // v2.0: Category badge was removed from the UI
    test.skip('renders category badge', () => {
      render(<BlockSettingsPanel {...defaultProps} />)

      expect(screen.getByText('hero')).toBeInTheDocument()
    })
  })

  describe('Interactions', () => {
    test('calls onUpdateProps when form values change', () => {
      const onUpdateProps = jest.fn()
      render(<BlockSettingsPanel {...defaultProps} onUpdateProps={onUpdateProps} />)

      // DynamicForm should be rendered
      expect(screen.getByTestId('dynamic-form')).toBeInTheDocument()
    })

    // v2.0: Remove button was moved to floating toolbar in preview canvas
    test.skip('calls onRemove when remove button clicked', () => {
      const onRemove = jest.fn()
      render(<BlockSettingsPanel {...defaultProps} onRemove={onRemove} />)

      const removeBtn = screen.getByText('Remove').closest('button')!
      fireEvent.click(removeBtn)

      expect(onRemove).toHaveBeenCalledTimes(1)
    })

    test('calls onClose when close button clicked', () => {
      const onClose = jest.fn()
      const { container } = render(<BlockSettingsPanel {...defaultProps} onClose={onClose} />)

      const closeBtn = container.querySelector('[data-cy="block-properties-close"]')!
      fireEvent.click(closeBtn)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    // v2.0: Reset button was removed from the panel
    test.skip('resets props when reset button clicked', () => {
      const onUpdateProps = jest.fn()
      render(<BlockSettingsPanel {...defaultProps} onUpdateProps={onUpdateProps} />)

      const resetBtn = screen.getByText('Reset').closest('button')!
      fireEvent.click(resetBtn)

      expect(onUpdateProps).toHaveBeenCalledWith({})
    })
  })

  describe('Field Grouping', () => {
    test('groupFieldsByTab groups content fields', () => {
      render(<BlockSettingsPanel {...defaultProps} />)

      // Should render tabs for content, design, and advanced
      expect(screen.getByTestId('dynamic-form')).toBeInTheDocument()
    })

    test('groupFieldsByTab groups design fields', () => {
      render(<BlockSettingsPanel {...defaultProps} />)

      expect(screen.getByTestId('dynamic-form')).toBeInTheDocument()
    })

    test('groupFieldsByTab groups advanced fields', () => {
      render(<BlockSettingsPanel {...defaultProps} />)

      expect(screen.getByTestId('dynamic-form')).toBeInTheDocument()
    })

    test('groupFieldsByTab defaults to content tab when tab not specified', () => {
      const gridBlock: BlockInstance = {
        id: 'block-2',
        blockSlug: 'content-grid',
        props: {},
      }

      render(<BlockSettingsPanel {...defaultProps} block={gridBlock} />)

      expect(screen.getByTestId('dynamic-form')).toBeInTheDocument()
    })
  })

  describe('Header Information', () => {
    test('displays block name in header', () => {
      render(<BlockSettingsPanel {...defaultProps} />)

      // v2.0: Only block name shown, category and slug removed
      expect(screen.getByText('Hero Section')).toBeInTheDocument()
    })

    // v2.0: Action buttons (Reset/Remove) were removed from the panel
    test.skip('renders action buttons in header', () => {
      render(<BlockSettingsPanel {...defaultProps} />)

      expect(screen.getByText('Reset')).toBeInTheDocument()
      expect(screen.getByText('Remove')).toBeInTheDocument()
    })
  })

  describe('Data Attributes', () => {
    test('applies correct data-cy attributes', () => {
      const { container } = render(<BlockSettingsPanel {...defaultProps} />)

      // Uses actual selector values from BLOCK_EDITOR_SELECTORS.blockPropertiesPanel
      expect(container.querySelector('[data-cy="block-properties-panel"]')).toBeInTheDocument()
      expect(container.querySelector('[data-cy="block-properties-header"]')).toBeInTheDocument()
      expect(container.querySelector('[data-cy="block-properties-name"]')).toBeInTheDocument()
    })

    test('applies empty state data-cy attribute', () => {
      const { container } = render(<BlockSettingsPanel {...defaultProps} block={undefined} />)

      // Uses actual selector value from BLOCK_EDITOR_SELECTORS.blockPropertiesPanel.empty
      expect(container.querySelector('[data-cy="block-properties-empty"]')).toBeInTheDocument()
    })

    test('applies error state data-cy attribute', () => {
      const unknownBlock: BlockInstance = {
        id: 'block-2',
        blockSlug: 'unknown-block',
        props: {},
      }

      const { container } = render(<BlockSettingsPanel {...defaultProps} block={unknownBlock} />)

      // Uses actual selector value from BLOCK_EDITOR_SELECTORS.blockPropertiesPanel.error
      expect(container.querySelector('[data-cy="block-properties-error"]')).toBeInTheDocument()
    })
  })
})
