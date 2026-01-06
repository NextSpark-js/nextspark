/**
 * Blog Theme - Block Selectors
 *
 * This file defines selectors for block components in the theme.
 * It's placed in lib/ instead of tests/ so TypeScript can resolve imports.
 *
 * Used by:
 * - Block components (for data-cy attributes)
 * - Cypress tests (via tests/cypress/src/selectors.ts)
 */

import { createSelectorHelpers } from '@nextsparkjs/core/lib/test/selector-factory'
import { CORE_SELECTORS } from '@nextsparkjs/core/lib/test/core-selectors'

// =============================================================================
// BLOCK SELECTORS
// =============================================================================

/**
 * Block-specific selectors for the blog theme.
 * Each block has at minimum a 'container' selector.
 * Dynamic selectors use {index} placeholder.
 */
export const BLOCK_SELECTORS = {
  // Blog theme currently has no custom blocks
  // Add block selectors here when blocks are created
} as const

// =============================================================================
// ENTITY SELECTORS
// =============================================================================

/**
 * Entity-specific selectors for the blog theme.
 */
export const ENTITY_SELECTORS = {
  posts: {
    list: 'posts-list',
    listItem: 'post-item-{index}',
    card: 'post-card-{id}',
    title: 'post-title',
    excerpt: 'post-excerpt',
    content: 'post-content',
    featuredImage: 'post-featured-image',
    status: 'post-status',
    publishedAt: 'post-published-at',
    createButton: 'post-create-button',
    editButton: 'post-edit-button',
    deleteButton: 'post-delete-button',
    publishButton: 'post-publish-button',
    unpublishButton: 'post-unpublish-button',
    form: {
      container: 'post-form',
      title: 'post-form-title',
      slug: 'post-form-slug',
      excerpt: 'post-form-excerpt',
      content: 'post-form-content',
      featuredImage: 'post-form-featured-image',
      featured: 'post-form-featured',
      status: 'post-form-status',
      publishedAt: 'post-form-published-at',
      submit: 'post-form-submit',
      cancel: 'post-form-cancel',
    },
  },
  categories: {
    list: 'categories-list',
    listItem: 'category-item-{index}',
    card: 'category-card-{id}',
    name: 'category-name',
    slug: 'category-slug',
    description: 'category-description',
    createButton: 'category-create-button',
    editButton: 'category-edit-button',
    deleteButton: 'category-delete-button',
    form: {
      container: 'category-form',
      name: 'category-form-name',
      slug: 'category-form-slug',
      description: 'category-form-description',
      submit: 'category-form-submit',
      cancel: 'category-form-cancel',
    },
  },
} as const

// =============================================================================
// BLOG-SPECIFIC SELECTORS
// =============================================================================

/**
 * Blog-specific UI selectors.
 */
export const BLOG_SELECTORS = {
  editor: {
    container: 'post-editor',
    toolbar: 'editor-toolbar',
    preview: 'editor-preview',
    wysiwyg: 'wysiwyg-editor',
  },
  publicBlog: {
    container: 'public-blog',
    postList: 'public-post-list',
    postDetail: 'public-post-detail',
    authorInfo: 'post-author-info',
    categoryFilter: 'category-filter',
    searchInput: 'blog-search-input',
  },
} as const

// =============================================================================
// THEME SELECTORS (CORE + BLOCKS + ENTITIES + BLOG)
// =============================================================================

/**
 * Complete theme selectors merging core, blocks, and entities.
 */
export const THEME_SELECTORS = {
  ...CORE_SELECTORS,
  blocks: BLOCK_SELECTORS,
  entities: ENTITY_SELECTORS,
  blog: BLOG_SELECTORS,
} as const

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Create helpers bound to theme selectors
 */
const helpers = createSelectorHelpers(THEME_SELECTORS)

/**
 * Full selectors object (core + theme extensions)
 */
export const SELECTORS = helpers.SELECTORS

/**
 * Get a selector value by path
 *
 * @example
 * sel('auth.login.form') // 'login-form'
 * sel('entities.posts.list') // 'posts-list'
 * sel('entities.posts.listItem', { index: '0' }) // 'post-item-0'
 */
export const sel = helpers.sel

/**
 * Alias for sel
 */
export const s = helpers.s

/**
 * Get selector only in dev/test environments
 */
export const selDev = helpers.selDev

/**
 * Get Cypress selector string [data-cy="..."]
 *
 * @example
 * cySelector('entities.posts.list') // '[data-cy="posts-list"]'
 */
export const cySelector = helpers.cySelector

/**
 * Create entity-specific selector helpers
 */
export const entitySelectors = helpers.entitySelectors

/**
 * Type exports
 */
export type ThemeSelectorsType = typeof THEME_SELECTORS
export type BlockSelectorsType = typeof BLOCK_SELECTORS
export type EntitySelectorsType = typeof ENTITY_SELECTORS
export type { Replacements } from '@nextsparkjs/core/lib/test/selector-factory'
export { CORE_SELECTORS }
