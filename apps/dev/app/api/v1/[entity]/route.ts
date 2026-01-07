/**
 * Generic Entity List Route
 *
 * Catch-all route that handles GET and POST requests for any registered entity.
 * Supports dual authentication (API Keys + Sessions).
 *
 * Examples:
 * GET  /api/v1/products     -> List products
 * POST /api/v1/products     -> Create product
 * GET  /api/v1/orders       -> List orders
 * POST /api/v1/orders       -> Create order
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
  handleGenericList,
  handleGenericCreate,
  handleGenericOptions
} from '@nextsparkjs/core/lib/api/entity/generic-handler'

export const GET = handleGenericList
export const POST = handleGenericCreate
export const OPTIONS = handleGenericOptions
