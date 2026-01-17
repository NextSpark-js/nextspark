/**
 * Block System Types
 *
 * Type definitions for the dynamic block editor system.
 * Supports WordPress/Webflow-style page building with reusable blocks.
 */

import { z } from 'zod'

// ============================================================================
// BASE SCHEMAS - Common fields for all blocks (3-tab structure)
// ============================================================================

/**
 * CTA (Call-to-Action) Schema
 * Used for buttons/links in Content tab
 */
export const ctaSchema = z.object({
  text: z.string().min(1, 'CTA text is required'),
  link: z.string().url('Must be a valid URL').or(z.string().startsWith('/')),
  target: z.enum(['_self', '_blank']).default('_self'),
})

export type CTAConfig = z.infer<typeof ctaSchema>

/**
 * Base Content Schema
 * Tab 1: Content - Common content fields for all blocks
 * All fields are optional to allow flexibility
 *
 * Note: `content` is the unified field for descriptive text
 * (replaces previous description/subtitle fields)
 */
export const baseContentSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  cta: ctaSchema.optional(),
})

export type BaseContentProps = z.infer<typeof baseContentSchema>

/**
 * Background Color Options
 * Predefined theme-aware color options
 */
export const backgroundColorOptions = [
  'transparent',
  'white',
  'gray-50',
  'gray-100',
  'gray-900',
  'primary',
  'primary-light',
  'primary-dark',
  'secondary',
  'accent',
] as const

export type BackgroundColor = (typeof backgroundColorOptions)[number]

/**
 * Base Design Schema
 * Tab 2: Design - Visual/styling options
 */
export const baseDesignSchema = z.object({
  backgroundColor: z.enum(backgroundColorOptions).default('transparent'),
})

export type BaseDesignProps = z.infer<typeof baseDesignSchema>

/**
 * Base Advanced Schema
 * Tab 3: Advanced - Technical/developer options
 */
export const baseAdvancedSchema = z.object({
  className: z.string().optional(),
  id: z.string().optional(),
})

export type BaseAdvancedProps = z.infer<typeof baseAdvancedSchema>

/**
 * Combined Base Block Schema
 * Merges all three tab schemas for complete block props
 */
export const baseBlockSchema = baseContentSchema
  .merge(baseDesignSchema)
  .merge(baseAdvancedSchema)

export type BaseBlockProps = z.infer<typeof baseBlockSchema>

// ============================================================================
// HELPER FUNCTIONS - For applying base props to components
// ============================================================================

/**
 * Get CSS classes for background color
 * Maps backgroundColor prop to Tailwind classes
 */
export function getBackgroundClasses(backgroundColor?: BackgroundColor): string {
  const bgMap: Record<BackgroundColor, string> = {
    transparent: 'bg-transparent',
    white: 'bg-white',
    'gray-50': 'bg-gray-50',
    'gray-100': 'bg-gray-100',
    'gray-900': 'bg-gray-900 text-white',
    primary: 'bg-primary text-primary-foreground',
    'primary-light': 'bg-primary/10',
    'primary-dark': 'bg-primary-dark text-white',
    secondary: 'bg-secondary text-secondary-foreground',
    accent: 'bg-accent text-accent-foreground',
  }
  return bgMap[backgroundColor || 'transparent']
}

/**
 * Get section attributes from advanced props
 * Returns object for spreading onto section element
 */
export function getSectionAttributes(props: BaseAdvancedProps): {
  id?: string
  className?: string
} {
  return {
    ...(props.id && { id: props.id }),
    ...(props.className && { className: props.className }),
  }
}

/**
 * Build complete section class string
 * Combines background classes, custom className, and base section styles
 */
export function buildSectionClasses(
  baseClasses: string,
  props: Partial<BaseDesignProps & BaseAdvancedProps>
): string {
  const classes = [baseClasses]

  if (props.backgroundColor) {
    classes.push(getBackgroundClasses(props.backgroundColor))
  }

  if (props.className) {
    classes.push(props.className)
  }

  return classes.filter(Boolean).join(' ')
}

// ============================================================================
// FIELD TAB DEFINITIONS - For dynamic form generation in admin UI
// ============================================================================

/**
 * Field tab identifier
 */
export type FieldTab = 'content' | 'design' | 'advanced'

/**
 * Base field definitions for Content tab
 * These can be spread into any block's fieldDefinitions array
 *
 * Note: `content` is the unified rich-text field for descriptive text
 * (replaces previous description/subtitle fields)
 */
export const baseContentFields: FieldDefinition[] = [
  {
    name: 'title',
    label: 'Title',
    type: 'text',
    tab: 'content',
    required: false,
    placeholder: 'Enter section title...',
    helpText: 'Main heading for this section',
  },
  {
    name: 'content',
    label: 'Content',
    type: 'rich-text',
    tab: 'content',
    required: false,
    placeholder: 'Enter content...',
    helpText: 'Rich text content for this section',
  },
  // CTA fields - grouped together in the UI
  {
    name: 'cta.text',
    label: 'Text',
    type: 'text',
    tab: 'content',
    required: false,
    placeholder: 'Learn More',
    helpText: 'Button text',
    group: 'cta',
    groupLabel: 'Call to Action',
  },
  {
    name: 'cta.link',
    label: 'Link',
    type: 'url',
    tab: 'content',
    required: false,
    placeholder: '/contact or https://...',
    helpText: 'URL the button links to',
    group: 'cta',
  },
  {
    name: 'cta.target',
    label: 'Open in',
    type: 'select',
    tab: 'content',
    required: false,
    default: '_self',
    helpText: 'How the link opens',
    group: 'cta',
    options: [
      { label: 'Same window', value: '_self' },
      { label: 'New tab', value: '_blank' },
    ],
  },
]

/**
 * Base field definitions for Design tab
 */
export const baseDesignFields: FieldDefinition[] = [
  {
    name: 'backgroundColor',
    label: 'Background Color',
    type: 'select',
    tab: 'design',
    required: false,
    default: 'transparent',
    description: 'Section background color',
    options: backgroundColorOptions.map((color) => ({
      label: color.charAt(0).toUpperCase() + color.slice(1).replace('-', ' '),
      value: color,
    })),
  },
]

/**
 * Base field definitions for Advanced tab
 */
export const baseAdvancedFields: FieldDefinition[] = [
  {
    name: 'className',
    label: 'CSS Class',
    type: 'text',
    tab: 'advanced',
    required: false,
    placeholder: 'my-custom-class',
    description: 'Custom CSS class(es) to add to the section',
    helpText: 'Multiple classes can be separated by spaces',
  },
  {
    name: 'id',
    label: 'HTML ID',
    type: 'text',
    tab: 'advanced',
    required: false,
    placeholder: 'my-section-id',
    description: 'Unique identifier for this section',
    helpText: 'Can be used for anchor links (#my-section-id)',
  },
]

/**
 * All base fields combined
 * Includes Content + Design + Advanced fields
 */
export const allBaseFields: FieldDefinition[] = [
  ...baseContentFields,
  ...baseDesignFields,
  ...baseAdvancedFields,
]

/**
 * Helper to create block field definitions
 * Combines base fields with block-specific fields
 */
export function createBlockFieldDefinitions(
  blockSpecificFields: FieldDefinition[]
): FieldDefinition[] {
  // Insert block-specific content fields after base content fields
  const contentFields = [
    ...baseContentFields,
    ...blockSpecificFields.filter((f) => f.tab === 'content'),
  ]

  // Design and Advanced tabs use base fields + any specific overrides
  const designFields = [
    ...baseDesignFields,
    ...blockSpecificFields.filter((f) => f.tab === 'design'),
  ]

  const advancedFields = [
    ...baseAdvancedFields,
    ...blockSpecificFields.filter((f) => f.tab === 'advanced'),
  ]

  return [...contentFields, ...designFields, ...advancedFields]
}

/**
 * Field types supported by the dynamic form generator
 */
export type FieldType =
  | 'text'
  | 'textarea'
  | 'url'
  | 'email'
  | 'number'
  | 'color'
  | 'image'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'rich-text'
  | 'array'
  | 'date'
  | 'time'
  | 'datetime'

/**
 * Field definition for dynamic form generation
 * Describes a single configurable property of a block
 */
export interface FieldDefinition {
  name: string
  label: string
  type: FieldType
  tab: FieldTab // Which tab this field belongs to: 'content' | 'design' | 'advanced'
  required?: boolean
  default?: unknown
  placeholder?: string
  description?: string
  helpText?: string

  // Text/Textarea specific
  minLength?: number
  maxLength?: number
  rows?: number // For textarea

  // Number specific
  min?: number
  max?: number
  step?: number

  // Select/Radio specific
  options?: Array<{
    label: string
    value: string | number
  }>

  // Checkbox specific
  checkboxLabel?: string // Label displayed next to the switch/checkbox

  // Image specific
  accept?: string // MIME types
  maxSize?: number // Bytes
  aspectRatio?: string // e.g., "16:9"

  // Array specific
  itemType?: FieldType // Type of items in array
  itemFields?: FieldDefinition[] // For complex array items
  minItems?: number
  maxItems?: number

  // Conditional display
  condition?: {
    field: string
    operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan'
    value: unknown
  }

  // Field grouping (for visual grouping in the UI)
  group?: string // Group identifier (e.g., 'cta', 'secondaryButton')
  groupLabel?: string // Label for the group (only needed on first field of group)
}

/**
 * Block category for organization
 */
export type BlockCategory =
  | 'hero'
  | 'content'
  | 'features'
  | 'cta'
  | 'testimonials'
  | 'media'
  | 'forms'
  | 'navigation'
  | 'footer'
  | 'pricing'
  | 'team'
  | 'stats'
  | 'faq'
  | 'newsletter'
  | 'other'

/**
 * Block example instance for DevTools preview
 */
export interface BlockExample {
  /** Display name for the example (e.g., "Default", "Dark Background") */
  name: string
  /** Optional description of what this example demonstrates */
  description?: string
  /** Complete props to render this example */
  props: Record<string, unknown>
}

/**
 * Block configuration (metadata about a block type)
 */
export interface BlockConfig {
  slug: string
  name: string
  description: string
  category: BlockCategory
  icon?: string // Lucide icon name

  // Paths (for registry use)
  componentPath?: string
  schemaPath?: string
  fieldsPath?: string
  thumbnail?: string

  // Field definitions for admin UI form generation
  fieldDefinitions: FieldDefinition[]

  // Example instances for DevTools preview (always an array, empty if no examples)
  // NOTE: This is populated by the registry generator, not in block config files
  examples: BlockExample[]

  // NEW: Scope - contexts where this block is available
  // If undefined or empty, block is NOT available anywhere (explicit opt-in required)
  scope?: Array<'pages' | 'posts' | string>

  /**
   * Whether this block can be used inside patterns.
   * Default: true (blocks are allowed in patterns by default)
   * Set to false for blocks that should not be included in patterns.
   */
  allowInPatterns?: boolean

  // Schema reference (not the actual Zod schema, just metadata)
  schemaType?: string

  // Optional metadata
  tags?: string[]
  isCore?: boolean // True if from core, false if from theme/plugin
  source?: 'core' | 'theme' | 'plugin'
  sourceId?: string // Theme or plugin ID
  version?: string
  deprecated?: boolean
  replacedBy?: string // Slug of replacement block
}

/**
 * Block instance (actual block used in a page)
 */
export interface BlockInstance<TProps = Record<string, unknown>> {
  id: string // Unique ID for this instance
  blockSlug: string // References BlockConfig.slug
  props: TProps // Block-specific properties
  order?: number // For manual ordering (fallback if array order is not enough)
}

/**
 * Page status for publication workflow
 * Extensible: can add 'scheduled', 'archived', 'pending_review' etc.
 */
export type PageStatus = 'draft' | 'published' | 'scheduled' | 'archived' | string

/**
 * Page metadata
 */
export interface PageMetadata {
  title: string
  slug: string
  locale: string
  /** Publication status (replaces published boolean) */
  status: PageStatus
  createdAt?: Date | string
  updatedAt?: Date | string
  authorId?: string
}

/**
 * Page SEO configuration
 */
export interface PageSEO {
  title?: string
  description?: string
  keywords?: string
  ogImage?: string
  ogType?: 'website' | 'article' | 'product'
  canonical?: string
  noindex?: boolean
  nofollow?: boolean
}

/**
 * Complete page configuration
 */
export interface PageConfig {
  id: string
  slug: string
  title: string
  blocks: BlockInstance[]
  locale: string
  /** Publication status (replaces published boolean) */
  status: PageStatus
  seo?: PageSEO

  // Meta fields
  createdAt: Date | string
  updatedAt: Date | string
  authorId?: string
  themeSource?: string

  // Template info (if created from template)
  templateId?: string
  templateName?: string
}

/**
 * Page template for quick page creation
 */
export interface PageTemplate {
  id: string
  name: string
  description?: string
  blocks: Omit<BlockInstance, 'id'>[] // Template blocks without IDs (generated on use)
  thumbnail?: string
  category?: 'basic' | 'company' | 'marketing' | 'ecommerce' | 'other'
  tags?: string[]
}

/**
 * Validation result for block props
 */
export interface BlockValidationResult {
  valid: boolean
  errors?: Array<{
    field: string
    message: string
  }>
}

/**
 * Block registry entry (used by build-registry.mjs)
 */
export type BlockRegistry = Record<string, BlockConfig>

/**
 * API response types
 */
export interface BlocksListResponse {
  blocks: BlockConfig[]
  categories: BlockCategory[]
  total: number
}

export interface BlockDetailResponse {
  block: BlockConfig
}

export interface BlockValidateRequest {
  blockSlug: string
  props: Record<string, unknown>
}

export interface BlockValidateResponse {
  valid: boolean
  errors?: Record<string, string[]>
}

export interface PagesListResponse {
  pages: PageConfig[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface PageDetailResponse {
  page: PageConfig
}

export interface CreatePageRequest {
  slug: string
  title: string
  blocks?: BlockInstance[]
  locale?: string
  /** Publication status (default: 'draft') */
  status?: PageStatus
  seo?: PageSEO
  templateId?: string
}

export interface UpdatePageRequest {
  slug?: string
  title?: string
  blocks?: BlockInstance[]
  /** Publication status */
  status?: PageStatus
  seo?: PageSEO
}

export interface ValidateSlugRequest {
  slug: string
  locale?: string
  currentPageId?: string // For edit mode (exclude current page from check)
}

export interface ValidateSlugResponse {
  valid: boolean
  available: boolean
  error?: string
  suggestions?: string[]
}

/**
 * Type guard to check if a value is a valid BlockInstance
 */
export function isBlockInstance(value: unknown): value is BlockInstance {
  if (typeof value !== 'object' || value === null) return false
  const block = value as Record<string, unknown>
  return (
    typeof block.id === 'string' &&
    typeof block.blockSlug === 'string' &&
    typeof block.props === 'object' &&
    block.props !== null
  )
}

/**
 * Type guard to check if a value is a valid BlockConfig
 */
export function isBlockConfig(value: unknown): value is BlockConfig {
  if (typeof value !== 'object' || value === null) return false
  const config = value as Record<string, unknown>
  return (
    typeof config.slug === 'string' &&
    typeof config.name === 'string' &&
    typeof config.description === 'string' &&
    typeof config.category === 'string' &&
    Array.isArray(config.fieldDefinitions)
  )
}
