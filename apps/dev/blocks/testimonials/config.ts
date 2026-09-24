import type { BlockConfig } from '@nextsparkjs/core/types/blocks'

export const config: Omit<BlockConfig, 'schema' | 'fieldDefinitions' | 'Component' | 'examples'> = {
  slug: 'testimonials',
  name: 'Testimonials',
  description: 'Display customer testimonials with quotes, authors, and avatars',
  category: 'testimonials',
  icon: 'Quote',
  thumbnail: '/theme/blocks/testimonials/thumbnail.png',
  scope: ['pages']
}
