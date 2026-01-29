import type { BlockConfig } from '@/core/types/blocks'

export const config: Omit<BlockConfig, 'schema' | 'fieldDefinitions' | 'Component' | 'examples'> = {
  slug: 'text-content',
  name: 'Text Content',
  description: 'Rich text content block for paragraphs, lists, and formatted text',
  category: 'content',
  icon: 'FileText',
  thumbnail: '/theme/blocks/text-content/thumbnail.png'
}
