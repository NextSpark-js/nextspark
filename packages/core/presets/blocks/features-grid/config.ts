import type { BlockConfig } from '@/core/types/blocks'

export const config: Omit<BlockConfig, 'schema' | 'fieldDefinitions' | 'Component' | 'examples'> = {
  slug: 'features-grid',
  name: 'Features Grid',
  description: 'Grid layout displaying multiple features with icons, titles, and descriptions',
  category: 'content',
  icon: 'Grid',
  thumbnail: '/theme/blocks/features-grid/thumbnail.png'
}
