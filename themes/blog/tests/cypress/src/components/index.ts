/**
 * Blog Theme - Component POMs Index
 *
 * Exports all POM classes and types for blog theme E2E tests.
 * Follows the standardized Entity Testing Convention pattern.
 *
 * Usage:
 *   import { EntityList, PostsPOM, PostEditorPOM } from '@/classes/themes/blog/components'
 *   import type { EntityConfig, EditorMode } from '@/classes/themes/blog/components'
 */

// Generic POMs
export { EntityList, type EntityConfig } from './EntityList'
export { EntityForm } from './EntityForm'

// Entity-specific POMs
export { PostsPOM } from './PostsPOM'
export { PostEditorPOM, type EditorMode, type PostData } from './PostEditorPOM'
