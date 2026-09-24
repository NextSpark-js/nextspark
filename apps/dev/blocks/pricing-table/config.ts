import type { BlockConfig } from '@nextsparkjs/core/types/blocks'

export const config: Omit<BlockConfig, 'schema' | 'fieldDefinitions' | 'Component' | 'examples'> = {
  slug: 'pricing-table',
  name: 'Pricing Table',
  description: 'A pricing comparison table showing different plans with features list, price, CTA button, and optional "Popular" badge',
  category: 'pricing',
  icon: 'DollarSign',
  thumbnail: '/theme/blocks/pricing-table/thumbnail.png',
  scope: ['pages']
}
