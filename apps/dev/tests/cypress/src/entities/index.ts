/**
 * Entity POM exports
 *
 * Page Object Models for specific entities:
 * - TasksPOM: Tasks CRUD operations
 * - CustomersPOM: Customers CRUD operations
 * - PostsPOM: Posts list operations (use PostEditorPOM for editing)
 * - PagesPOM: Pages list operations (use PageBuilderPOM for editing)
 * - PatternsPOM: Patterns CRUD operations with usage tracking
 */

export { TasksPOM, type TaskFormData } from './TasksPOM'
export { CustomersPOM, type CustomerFormData } from './CustomersPOM'
export { PostsPOM, type PostListFilters } from './PostsPOM'
export { PagesPOM, type PageListFilters } from './PagesPOM'
export { PatternsPOM } from './PatternsPOM'
