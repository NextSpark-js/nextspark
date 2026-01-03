import { NextRequest, NextResponse } from 'next/server'
import { BLOCK_REGISTRY } from '@nextsparkjs/registries/block-registry'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  try {
    const { slug } = await params
    const block = BLOCK_REGISTRY[slug]

    if (!block) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 })
    }

    return NextResponse.json({
      slug: block.slug,
      name: block.name,
      description: block.description,
      category: block.category,
      icon: block.icon,
      thumbnail: block.thumbnail,
      fieldDefinitions: block.fieldDefinitions
    })
  } catch (err) {
    console.error('Error fetching block:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
