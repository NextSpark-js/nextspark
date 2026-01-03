/**
 * Blog Theme - Cypress POM Classes
 *
 * Page Object Model classes for testing the Blog theme.
 *
 * Usage:
 *   import { EntityList, PostsPOM, PostEditorPOM } from '@/classes/themes/blog'
 *
 * Legacy POMs (backwards compatibility):
 *   import { PostsList, PostEditor } from '@/classes/themes/blog'
 */

// ============================================
// NEW: Entity Testing Convention POMs (TypeScript)
// ============================================

// Generic POMs
export { EntityList } from './components/EntityList.ts'
export { EntityForm } from './components/EntityForm.ts'

// Entity-specific POMs
export { PostsPOM } from './components/PostsPOM.ts'
export { PostEditorPOM } from './components/PostEditorPOM.ts'

// ============================================
// LEGACY: Original POMs (JavaScript)
// Kept for backwards compatibility with existing tests
// ============================================

export { PostsList } from './PostsList.js'
export { PostEditor } from './PostEditor.js'
export { WysiwygEditor } from './WysiwygEditor.js'
export { FeaturedImageUpload } from './FeaturedImageUpload.js'
