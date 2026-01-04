import type { BlockConfig } from '@nextsparkjs/core/types/blocks'

export const config: Omit<BlockConfig, 'schema' | 'fieldDefinitions' | 'Component' | 'examples'> = {
  slug: 'post-content',
  name: 'Post Content',
  description: 'A rich text content block designed for long-form blog posts with editorial styling similar to Medium. Features beautiful typography, proper spacing, and optional elements like drop caps, pull quotes, and images.',
  category: 'content',
  icon: 'FileText',
  thumbnail: '/theme/blocks/post-content/thumbnail.png',
  scope: ['posts']
}
