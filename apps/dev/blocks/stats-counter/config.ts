import type { BlockConfig } from '@nextsparkjs/core/types/blocks'

export const config: Omit<BlockConfig, 'schema' | 'fieldDefinitions' | 'Component' | 'examples'> = {
  slug: 'stats-counter',
  name: 'Stats Counter',
  description: 'A section displaying key metrics/statistics with large numbers and labels (e.g., "10,000+ Customers", "99% Uptime")',
  category: 'stats',
  icon: 'TrendingUp',
  thumbnail: '/theme/blocks/stats-counter/thumbnail.png',
  scope: ['pages', 'posts']
}
