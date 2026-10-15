import { NextRequest, NextResponse } from 'next/server'
import { BLOCK_REGISTRY } from '@nextsparkjs/registries/block-registry'
import { BLOCK_SCHEMAS } from '@nextsparkjs/registries/block-schemas'
import * as z from 'zod'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'
import { createApiError } from '@nextsparkjs/core/lib/api/helpers'

const requestSchema = z.object({
  blockSlug: z.string(),
  props: z.record(z.string(), z.unknown())
})

export const POST = withRateLimitTier(async (request: NextRequest) => {
  try {
    const parsed = requestSchema.safeParse(await request.json().catch(() => undefined))
    if (!parsed.success) {
      return createApiError('Validation error', 400, parsed.error.issues, 'VALIDATION_ERROR')
    }
    const { blockSlug, props } = parsed.data

    // own keys only: `constructor`, `toString` and the like are not blocks
    const block = Object.hasOwn(BLOCK_REGISTRY, blockSlug) ? BLOCK_REGISTRY[blockSlug] : undefined

    if (!block) {
      return createApiError('Block not found', 404, undefined, 'NOT_FOUND')
    }

    // Each block's schema, imported statically by the generated registry and picked by slug
    const schema = Object.hasOwn(BLOCK_SCHEMAS, blockSlug) ? (BLOCK_SCHEMAS as Record<string, z.ZodType | undefined>)[blockSlug] : undefined
    if (!schema) {
      return createApiError('Block schema not found', 500, undefined, 'INTERNAL_ERROR')
    }

    try {
      schema.parse(props)
      return NextResponse.json({ valid: true })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({
          valid: false,
          errors: error.issues
        }, { status: 400 })
      }
      throw error
    }
  } catch (err) {
    console.error('Error validating block:', err)
    return createApiError('Internal server error', 500, undefined, 'INTERNAL_ERROR')
  }
}, 'write');

export const OPTIONS = corsPreflight
