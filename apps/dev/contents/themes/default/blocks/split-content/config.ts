import type { BlockConfig } from '@nextsparkjs/core/types/blocks'

export const config: Omit<BlockConfig, 'schema' | 'fieldDefinitions' | 'Component' | 'examples'> = {
  slug: 'split-content',
  name: 'Split Content',
  description: 'A two-column section with image on one side and text content on the other, with option to reverse the order',
  category: 'content',
  icon: 'LayoutGrid',
  thumbnail: '/theme/blocks/split-content/thumbnail.png',
  scope: ['pages', 'posts']
}
