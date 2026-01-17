import { NextRequest, NextResponse } from 'next/server'
import { BLOCK_REGISTRY, BLOCK_CATEGORIES } from '@nextsparkjs/registries/block-registry'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'

export const GET = withRateLimitTier(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const scope = searchParams.get('scope')

    let blocks = Object.values(BLOCK_REGISTRY)

    // Filter by category
    if (category) {
      blocks = blocks.filter(block => block.category === category)
    }

    // Filter by scope (pages, posts, etc.)
    if (scope) {
      blocks = blocks.filter(block => block.scope?.includes(scope))
    }

    const blocksMetadata = blocks.map(block => ({
      slug: block.slug,
      name: block.name,
      description: block.description,
      category: block.category,
      icon: block.icon,
      thumbnail: block.thumbnail,
      fieldDefinitions: block.fieldDefinitions,
      scope: block.scope
    }))

    return NextResponse.json({
      success: true,
      data: blocksMetadata,
      meta: {
        categories: BLOCK_CATEGORIES,
        total: blocksMetadata.length
      }
    })
  } catch (err) {
    console.error('Error listing blocks:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}, 'read');
