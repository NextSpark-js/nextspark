/**
 * ApiInterceptor - Re-export from @nextsparkjs/testing
 *
 * The ApiInterceptor class is provided by @nextsparkjs/testing.
 * This file exists for backward compatibility and to allow
 * theme-specific extensions if needed.
 *
 * @example Basic usage:
 * ```ts
 * import { ApiInterceptor } from '../helpers/ApiInterceptor'
 *
 * const api = new ApiInterceptor('tasks')
 * api.setupCrudIntercepts()
 * cy.visit('/dashboard/tasks')
 * api.waitForList()
 * ```
 */

// Re-export from testing package
export { ApiInterceptor, type ApiInterceptorConfig } from '@nextsparkjs/testing/helpers'
