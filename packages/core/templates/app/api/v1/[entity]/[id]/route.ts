/**
 * Generic Entity Detail Route
 *
 * Catch-all route that handles GET, PATCH, and DELETE requests for any registered entity.
 * Supports dual authentication (API Keys + Sessions).
 *
 * Examples:
 * GET    /api/v1/products/123     -> Get product by ID
 * PATCH  /api/v1/products/123     -> Update product
 * DELETE /api/v1/products/123     -> Delete product
 * GET    /api/v1/orders/456       -> Get order by ID
 * PATCH  /api/v1/orders/456       -> Update order
 * DELETE /api/v1/orders/456       -> Delete order
 */

import {
  handleGenericRead,
  handleGenericUpdate,
  handleGenericDelete,
  handleGenericOptions
} from '@nextsparkjs/core/lib/api/entity/generic-handler'
import { setEntityRegistry } from '@nextsparkjs/core/lib/entities/queries'
// Import registry directly - webpack resolves @nextsparkjs/registries alias at compile time
import { ENTITY_REGISTRY, ENTITY_METADATA } from '@nextsparkjs/registries/entity-registry'

// Initialize registry at module load time (before any handler runs)
setEntityRegistry(ENTITY_REGISTRY, ENTITY_METADATA)

export const GET = handleGenericRead
export const PATCH = handleGenericUpdate
export const DELETE = handleGenericDelete
export const OPTIONS = handleGenericOptions
