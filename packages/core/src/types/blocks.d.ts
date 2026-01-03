/**
 * Block System Types
 *
 * Type definitions for the dynamic block editor system.
 * Supports WordPress/Webflow-style page building with reusable blocks.
 */
import { z } from 'zod';
/**
 * CTA (Call-to-Action) Schema
 * Used for buttons/links in Content tab
 */
export declare const ctaSchema: any;
export type CTAConfig = z.infer<typeof ctaSchema>;
/**
 * Base Content Schema
 * Tab 1: Content - Common content fields for all blocks
 * All fields are optional to allow flexibility
 *
 * Note: `content` is the unified field for descriptive text
 * (replaces previous description/subtitle fields)
 */
export declare const baseContentSchema: any;
export type BaseContentProps = z.infer<typeof baseContentSchema>;
/**
 * Background Color Options
 * Predefined theme-aware color options
 */
export declare const backgroundColorOptions: readonly ["transparent", "white", "gray-50", "gray-100", "gray-900", "primary", "primary-light", "primary-dark", "secondary", "accent"];
export type BackgroundColor = (typeof backgroundColorOptions)[number];
/**
 * Base Design Schema
 * Tab 2: Design - Visual/styling options
 */
export declare const baseDesignSchema: any;
export type BaseDesignProps = z.infer<typeof baseDesignSchema>;
/**
 * Base Advanced Schema
 * Tab 3: Advanced - Technical/developer options
 */
export declare const baseAdvancedSchema: any;
export type BaseAdvancedProps = z.infer<typeof baseAdvancedSchema>;
/**
 * Combined Base Block Schema
 * Merges all three tab schemas for complete block props
 */
export declare const baseBlockSchema: any;
export type BaseBlockProps = z.infer<typeof baseBlockSchema>;
/**
 * Get CSS classes for background color
 * Maps backgroundColor prop to Tailwind classes
 */
export declare function getBackgroundClasses(backgroundColor?: BackgroundColor): string;
/**
 * Get section attributes from advanced props
 * Returns object for spreading onto section element
 */
export declare function getSectionAttributes(props: BaseAdvancedProps): {
    id?: string;
    className?: string;
};
/**
 * Build complete section class string
 * Combines background classes, custom className, and base section styles
 */
export declare function buildSectionClasses(baseClasses: string, props: Partial<BaseDesignProps & BaseAdvancedProps>): string;
/**
 * Field tab identifier
 */
export type FieldTab = 'content' | 'design' | 'advanced';
/**
 * Base field definitions for Content tab
 * These can be spread into any block's fieldDefinitions array
 *
 * Note: `content` is the unified rich-text field for descriptive text
 * (replaces previous description/subtitle fields)
 */
export declare const baseContentFields: FieldDefinition[];
/**
 * Base field definitions for Design tab
 */
export declare const baseDesignFields: FieldDefinition[];
/**
 * Base field definitions for Advanced tab
 */
export declare const baseAdvancedFields: FieldDefinition[];
/**
 * All base fields combined
 * Includes Content + Design + Advanced fields
 */
export declare const allBaseFields: FieldDefinition[];
/**
 * Helper to create block field definitions
 * Combines base fields with block-specific fields
 */
export declare function createBlockFieldDefinitions(blockSpecificFields: FieldDefinition[]): FieldDefinition[];
/**
 * Field types supported by the dynamic form generator
 */
export type FieldType = 'text' | 'textarea' | 'url' | 'email' | 'number' | 'color' | 'image' | 'select' | 'checkbox' | 'radio' | 'rich-text' | 'array' | 'date' | 'time' | 'datetime';
/**
 * Field definition for dynamic form generation
 * Describes a single configurable property of a block
 */
export interface FieldDefinition {
    name: string;
    label: string;
    type: FieldType;
    tab: FieldTab;
    required?: boolean;
    default?: unknown;
    placeholder?: string;
    description?: string;
    helpText?: string;
    minLength?: number;
    maxLength?: number;
    rows?: number;
    min?: number;
    max?: number;
    step?: number;
    options?: Array<{
        label: string;
        value: string | number;
    }>;
    checkboxLabel?: string;
    accept?: string;
    maxSize?: number;
    aspectRatio?: string;
    itemType?: FieldType;
    itemFields?: FieldDefinition[];
    minItems?: number;
    maxItems?: number;
    condition?: {
        field: string;
        operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan';
        value: unknown;
    };
    group?: string;
    groupLabel?: string;
}
/**
 * Block category for organization
 */
export type BlockCategory = 'hero' | 'content' | 'features' | 'cta' | 'testimonials' | 'media' | 'forms' | 'navigation' | 'footer' | 'pricing' | 'team' | 'stats' | 'faq' | 'newsletter' | 'other';
/**
 * Block example instance for DevTools preview
 */
export interface BlockExample {
    /** Display name for the example (e.g., "Default", "Dark Background") */
    name: string;
    /** Optional description of what this example demonstrates */
    description?: string;
    /** Complete props to render this example */
    props: Record<string, unknown>;
}
/**
 * Block configuration (metadata about a block type)
 */
export interface BlockConfig {
    slug: string;
    name: string;
    description: string;
    category: BlockCategory;
    icon?: string;
    componentPath?: string;
    schemaPath?: string;
    fieldsPath?: string;
    thumbnail?: string;
    fieldDefinitions: FieldDefinition[];
    examples: BlockExample[];
    scope?: Array<'pages' | 'posts' | string>;
    schemaType?: string;
    tags?: string[];
    isCore?: boolean;
    source?: 'core' | 'theme' | 'plugin';
    sourceId?: string;
    version?: string;
    deprecated?: boolean;
    replacedBy?: string;
}
/**
 * Block instance (actual block used in a page)
 */
export interface BlockInstance<TProps = Record<string, unknown>> {
    id: string;
    blockSlug: string;
    props: TProps;
    order?: number;
}
/**
 * Page status for publication workflow
 * Extensible: can add 'scheduled', 'archived', 'pending_review' etc.
 */
export type PageStatus = 'draft' | 'published' | 'scheduled' | 'archived' | string;
/**
 * Page metadata
 */
export interface PageMetadata {
    title: string;
    slug: string;
    locale: string;
    /** Publication status (replaces published boolean) */
    status: PageStatus;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    authorId?: string;
}
/**
 * Page SEO configuration
 */
export interface PageSEO {
    title?: string;
    description?: string;
    keywords?: string;
    ogImage?: string;
    ogType?: 'website' | 'article' | 'product';
    canonical?: string;
    noindex?: boolean;
    nofollow?: boolean;
}
/**
 * Complete page configuration
 */
export interface PageConfig {
    id: string;
    slug: string;
    title: string;
    blocks: BlockInstance[];
    locale: string;
    /** Publication status (replaces published boolean) */
    status: PageStatus;
    seo?: PageSEO;
    createdAt: Date | string;
    updatedAt: Date | string;
    authorId?: string;
    themeSource?: string;
    templateId?: string;
    templateName?: string;
}
/**
 * Page template for quick page creation
 */
export interface PageTemplate {
    id: string;
    name: string;
    description?: string;
    blocks: Omit<BlockInstance, 'id'>[];
    thumbnail?: string;
    category?: 'basic' | 'company' | 'marketing' | 'ecommerce' | 'other';
    tags?: string[];
}
/**
 * Validation result for block props
 */
export interface BlockValidationResult {
    valid: boolean;
    errors?: Array<{
        field: string;
        message: string;
    }>;
}
/**
 * Block registry entry (used by build-registry.mjs)
 */
export type BlockRegistry = Record<string, BlockConfig>;
/**
 * API response types
 */
export interface BlocksListResponse {
    blocks: BlockConfig[];
    categories: BlockCategory[];
    total: number;
}
export interface BlockDetailResponse {
    block: BlockConfig;
}
export interface BlockValidateRequest {
    blockSlug: string;
    props: Record<string, unknown>;
}
export interface BlockValidateResponse {
    valid: boolean;
    errors?: Record<string, string[]>;
}
export interface PagesListResponse {
    pages: PageConfig[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}
export interface PageDetailResponse {
    page: PageConfig;
}
export interface CreatePageRequest {
    slug: string;
    title: string;
    blocks?: BlockInstance[];
    locale?: string;
    /** Publication status (default: 'draft') */
    status?: PageStatus;
    seo?: PageSEO;
    templateId?: string;
}
export interface UpdatePageRequest {
    slug?: string;
    title?: string;
    blocks?: BlockInstance[];
    /** Publication status */
    status?: PageStatus;
    seo?: PageSEO;
}
export interface ValidateSlugRequest {
    slug: string;
    locale?: string;
    currentPageId?: string;
}
export interface ValidateSlugResponse {
    valid: boolean;
    available: boolean;
    error?: string;
    suggestions?: string[];
}
/**
 * Type guard to check if a value is a valid BlockInstance
 */
export declare function isBlockInstance(value: unknown): value is BlockInstance;
/**
 * Type guard to check if a value is a valid BlockConfig
 */
export declare function isBlockConfig(value: unknown): value is BlockConfig;
//# sourceMappingURL=blocks.d.ts.map