/**
 * API endpoint for child entities
 * GET /api/v1/[entity]/[id]/child/[childType]
 * POST /api/v1/[entity]/[id]/child/[childType]
 *
 * Same authentication, team context, permissions and validation as the entity routes, on the parent record.
 */

import { handleChildList, handleChildCreate } from '@nextsparkjs/core/lib/api/entity/generic-handler'
import { setEntityRegistry } from '@nextsparkjs/core/lib/entities/queries'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'
// Import registry directly - webpack resolves @nextsparkjs/registries alias at compile time
import { ENTITY_REGISTRY, ENTITY_METADATA } from '@nextsparkjs/registries/entity-registry'

// Initialize registry at module load time (before any handler runs)
setEntityRegistry(ENTITY_REGISTRY, ENTITY_METADATA)

export const GET = withRateLimitTier(handleChildList, 'read')
export const POST = withRateLimitTier(handleChildCreate, 'write')
export const OPTIONS = corsPreflight
