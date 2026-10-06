import { NextRequest, NextResponse } from 'next/server'
import { BLOCK_REGISTRY } from '@nextsparkjs/registries/block-registry'
import { BLOCK_SCHEMAS } from '@nextsparkjs/registries/block-schemas'
import * as z from 'zod'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'

const requestSchema = z.object({
  blockSlug: z.string(),
  props: z.record(z.string(), z.unknown())
})

export const POST = withRateLimitTier(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { blockSlug, props } = requestSchema.parse(body)

    const block = BLOCK_REGISTRY[blockSlug]

    if (!block) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 })
    }

    // Each block's schema, imported statically by the generated registry and picked by slug
    const schema = (BLOCK_SCHEMAS as Record<string, z.ZodType | undefined>)[blockSlug]
    if (!schema) {
      return NextResponse.json({ error: 'Block schema not found' }, { status: 500 })
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}, 'write');

export const OPTIONS = corsPreflight
