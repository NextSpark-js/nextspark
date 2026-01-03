import type { BlockConfig } from '@nextsparkjs/core/types/blocks'

export const config: Omit<BlockConfig, 'schema' | 'fieldDefinitions' | 'Component' | 'examples'> = {
  slug: 'faq-accordion',
  name: 'FAQ Accordion',
  description: 'A frequently asked questions section with expandable/collapsible accordion items',
  category: 'faq',
  icon: 'HelpCircle',
  thumbnail: '/theme/blocks/faq-accordion/thumbnail.png',
  scope: ['pages']
}
