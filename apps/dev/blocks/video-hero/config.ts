import type { BlockConfig } from '@nextsparkjs/core/types/blocks'

export const config: Omit<BlockConfig, 'schema' | 'fieldDefinitions' | 'Component' | 'examples'> = {
  slug: 'video-hero',
  name: 'Video Hero',
  description: 'A hero section with embedded video (YouTube/Vimeo) either as background or inline, with title, subtitle, and optional CTA',
  category: 'hero',
  icon: 'Video',
  thumbnail: '/theme/blocks/video-hero/thumbnail.png',
  scope: ['pages', 'posts']
}
