import type { BlockConfig } from '@nextsparkjs/core/types/blocks'

export const config: Omit<BlockConfig, 'schema' | 'fieldDefinitions' | 'Component' | 'examples'> = {
  slug: 'timeline',
  name: 'Timeline',
  description: 'A vertical or horizontal timeline showing chronological events, process steps, or history',
  category: 'content',
  icon: 'GitBranch',
  thumbnail: '/theme/blocks/timeline/thumbnail.png',
  scope: ['pages', 'posts']
}
