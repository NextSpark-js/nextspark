import type { BlockConfig } from '@nextsparkjs/core/types/blocks'

export const config: Omit<BlockConfig, 'schema' | 'fieldDefinitions' | 'Component' | 'examples'> = {
  slug: 'hero-with-form',
  name: 'Hero With Form',
  description: 'Full-width hero section with background image, title/subtitle on the left, and a lead capture form card on the right',
  category: 'hero',
  icon: 'FileText',
  thumbnail: '/theme/blocks/hero-with-form/thumbnail.png',
  scope: ['pages']
}
