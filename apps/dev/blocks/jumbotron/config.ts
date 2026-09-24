import type { BlockConfig } from '@nextsparkjs/core/types/blocks'

export const config: Omit<BlockConfig, 'schema' | 'fieldDefinitions' | 'Component' | 'examples'> = {
  slug: 'jumbotron',
  name: 'Jumbotron',
  description: 'A large, attention-grabbing hero block with optional fullscreen mode that takes 100% of the viewport height when enabled. Features centered content with support for 1-2 CTAs that automatically center based on count.',
  category: 'hero',
  icon: 'Maximize2',
  thumbnail: '/theme/blocks/jumbotron/thumbnail.png',
  scope: ['pages', 'posts']
}
