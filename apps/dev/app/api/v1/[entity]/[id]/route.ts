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

// CRITICAL: Initialize entity registry for API routes
// This import is processed by webpack which resolves the @nextsparkjs alias
// The setEntityRegistry call happens at module load time
import { setEntityRegistry, isRegistryInitialized } from '@nextsparkjs/core/lib/entities/queries'
import { ENTITY_REGISTRY, ENTITY_METADATA } from '@nextsparkjs/registries/entity-registry'
if (!isRegistryInitialized()) {
  setEntityRegistry(ENTITY_REGISTRY, ENTITY_METADATA)
}

import {
  handleGenericRead,
  handleGenericUpdate,
  handleGenericDelete,
  handleGenericOptions
} from '@nextsparkjs/core/lib/api/entity/generic-handler'

export const GET = handleGenericRead
export const PATCH = handleGenericUpdate
export const DELETE = handleGenericDelete
export const OPTIONS = handleGenericOptions
