import { NextRequest, NextResponse } from 'next/server'
import { createApiError } from '@nextsparkjs/core/lib/api/error-response'
import { BLOCK_REGISTRY } from '@nextsparkjs/registries/block-registry'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'

export const GET = withRateLimitTier(async (
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> => {
  try {
    const { slug } = await params
    // an own key only: `constructor`, `toString` and the like are not blocks
    const block = Object.hasOwn(BLOCK_REGISTRY, slug) ? BLOCK_REGISTRY[slug] : undefined

    if (!block) {
      return createApiError('Block not found', 404, undefined, 'NOT_FOUND')
    }

    return NextResponse.json({
      slug: block.slug,
      name: block.name,
      description: block.description,
      category: block.category,
      icon: block.icon,
      thumbnail: block.thumbnail?.src,
      fieldDefinitions: block.fieldDefinitions
    })
  } catch (err) {
    console.error('Error fetching block:', err)
    return createApiError('Internal server error', 500, undefined, 'INTERNAL_ERROR')
  }
}, 'read');

export const OPTIONS = corsPreflight
