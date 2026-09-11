/**
 * Starter Theme - Entity POM exports
 *
 * Page Object Models for specific entities:
 * - TasksPOM: Tasks CRUD operations
 * - PatternsPOM: Patterns CRUD operations with usage tracking (core entity)
 * - PagesPOM: Pages CRUD operations (the block editor specs build on it)
 *
 * Add more entity POMs as you create new entities.
 */

export { TasksPOM, type TaskFormData } from './TasksPOM'
export { PatternsPOM } from './PatternsPOM'
export { PagesPOM } from './PagesPOM'
