/**
 * Cypress API Controllers
 *
 * Centralized exports for all API controllers.
 * All controllers extend BaseAPIController and guarantee:
 * - Consistent Authorization header handling
 * - Consistent x-team-id header handling (when teamId configured)
 * - Standard CRUD operations
 * - Common validators
 */

module.exports = {
  // Base class
  BaseAPIController: require('./BaseAPIController'),

  // Entity-specific controllers (team-scoped)
  TasksAPIController: require('./TaskAPIController'),
  CustomersAPIController: require('./CustomerAPIController'),
  PostsAPIController: require('./PostsAPIController'),
  PagesAPIController: require('./PagesAPIController'),

  // Entity-specific controllers (global - no team required)
  UsersAPIController: require('./UsersAPIController'),
  ApiKeysAPIController: require('./ApiKeysAPIController')
}
