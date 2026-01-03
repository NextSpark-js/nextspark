import type { BlockConfig } from '@/core/types/blocks'

export const config: Omit<BlockConfig, 'schema' | 'fieldDefinitions' | 'Component' | 'examples'> = {
  slug: 'cta-section',
  name: 'CTA Section',
  description: 'Call-to-action section with title, description, and action buttons',
  category: 'cta',
  icon: 'Megaphone',
  thumbnail: '/theme/blocks/cta-section/thumbnail.png'
}
