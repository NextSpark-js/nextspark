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

import {
  handleGenericList,
  handleGenericCreate,
  handleGenericOptions
} from '@nextsparkjs/core/lib/api/entity/generic-handler'
import { setEntityRegistry } from '@nextsparkjs/core/lib/entities/queries'
// Import registry directly - webpack resolves @nextsparkjs/registries alias at compile time
import { ENTITY_REGISTRY, ENTITY_METADATA } from '@nextsparkjs/registries/entity-registry'

// Initialize registry at module load time (before any handler runs)
setEntityRegistry(ENTITY_REGISTRY, ENTITY_METADATA)

export const GET = handleGenericList
export const POST = handleGenericCreate
export const OPTIONS = handleGenericOptions
