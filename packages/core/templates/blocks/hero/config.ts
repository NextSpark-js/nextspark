import type { BlockConfig } from '@nextsparkjs/core/types/blocks'

export const config: Omit<BlockConfig, 'schema' | 'fieldDefinitions' | 'Component' | 'examples'> = {
  slug: 'hero',
  name: 'Hero Section',
  description: 'Full-width hero section with title, subtitle, CTA button, and background image',
  category: 'hero',
  icon: 'Rocket',
  thumbnail: '/theme/blocks/hero/thumbnail.png',
  scope: ['pages', 'posts']
}
