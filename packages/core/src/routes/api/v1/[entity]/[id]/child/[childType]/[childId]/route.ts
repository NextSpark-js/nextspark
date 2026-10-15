/**
 * API endpoint for individual child entity operations
 * PUT /api/v1/[entity]/[id]/child/[childType]/[childId]
 * DELETE /api/v1/[entity]/[id]/child/[childType]/[childId]
 *
 * Same authentication, team context, permissions and validation as the entity routes, on the parent record.
 */

import { handleChildUpdate, handleChildDelete } from '@nextsparkjs/core/lib/api/entity/generic-handler'
import { setEntityRegistry } from '@nextsparkjs/core/lib/entities/queries'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'
// Import registry directly - webpack resolves @nextsparkjs/registries alias at compile time
import { ENTITY_REGISTRY, ENTITY_METADATA } from '@nextsparkjs/registries/entity-registry'

// Initialize registry at module load time (before any handler runs)
setEntityRegistry(ENTITY_REGISTRY, ENTITY_METADATA)

export const PUT = withRateLimitTier(handleChildUpdate, 'write')
export const DELETE = withRateLimitTier(handleChildDelete, 'write')
export const OPTIONS = corsPreflight
