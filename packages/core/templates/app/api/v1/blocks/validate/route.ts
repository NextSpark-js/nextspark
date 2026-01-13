import { NextRequest, NextResponse } from 'next/server'
import { BLOCK_REGISTRY } from '@nextsparkjs/registries/block-registry'
import { z } from 'zod'

const requestSchema = z.object({
  blockSlug: z.string(),
  props: z.record(z.string(), z.unknown())
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { blockSlug, props } = requestSchema.parse(body)

    const block = BLOCK_REGISTRY[blockSlug]

    if (!block) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 })
    }

    if (!block.schemaPath) {
      return NextResponse.json({ error: 'Block schema not found' }, { status: 500 })
    }

    try {
      // Dynamic import is allowed here (server-side validation, not registry loading)
      // webpackIgnore tells webpack to skip static analysis for this intentional dynamic import
      const schemaModule = await import(/* webpackIgnore: true */ block.schemaPath)
      const schema = schemaModule.schema

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
}
