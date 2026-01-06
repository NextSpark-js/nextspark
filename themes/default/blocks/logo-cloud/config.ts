import type { BlockConfig } from '@nextsparkjs/core/types/blocks'

export const config: Omit<BlockConfig, 'schema' | 'fieldDefinitions' | 'Component' | 'examples'> = {
  slug: 'logo-cloud',
  name: 'Logo Cloud',
  description: 'A section displaying client/partner logos in a grid or row layout ("Trusted by...", "As seen in...")',
  category: 'content',
  icon: 'Building2',
  thumbnail: '/theme/blocks/logo-cloud/thumbnail.png',
  scope: ['pages']
}
