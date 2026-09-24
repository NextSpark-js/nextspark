import type { BlockConfig } from '@nextsparkjs/core/types/blocks'

export const config: Omit<BlockConfig, 'schema' | 'fieldDefinitions' | 'Component' | 'examples'> = {
  slug: 'benefits',
  name: 'Benefits Grid',
  description: '3-column grid showcasing benefits with optional colored top borders',
  category: 'features',
  icon: 'LayoutGrid',
  thumbnail: '/theme/blocks/benefits/thumbnail.png',
  scope: ['pages']
}
