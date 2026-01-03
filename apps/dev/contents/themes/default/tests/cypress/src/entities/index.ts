/**
 * Entity POM exports
 *
 * Page Object Models for specific entities:
 * - TasksPOM: Tasks CRUD operations
 * - CustomersPOM: Customers CRUD operations
 * - PostsPOM: Posts list operations (use PostEditorPOM for editing)
 * - PagesPOM: Pages list operations (use PageBuilderPOM for editing)
 */

export { TasksPOM, type TaskFormData } from './TasksPOM'
export { CustomersPOM, type CustomerFormData } from './CustomersPOM'
export { PostsPOM, type PostListFilters } from './PostsPOM'
export { PagesPOM, type PageListFilters } from './PagesPOM'
