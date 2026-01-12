/**
 * API Presets for Public Posts
 *
 * Public feed of published blog posts (no authentication required)
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  endpoint: '/api/v1/theme/blog/posts/public',
  summary: 'Public feed of published blog posts',
  presets: [
    {
      id: 'list-recent',
      title: 'List Recent Posts',
      description: 'Get recent published posts',
      method: 'GET',
      params: {
        limit: 20
      },
      tags: ['read', 'list', 'public']
    },
    {
      id: 'list-with-limit',
      title: 'List with Custom Limit',
      description: 'Get posts with specific limit',
      method: 'GET',
      params: {
        limit: '{{limit}}'
      },
      tags: ['read', 'list', 'public']
    },
    {
      id: 'list-by-category',
      title: 'List by Category',
      description: 'Get posts filtered by category slug',
      method: 'GET',
      params: {
        category: '{{category}}'
      },
      tags: ['read', 'filter', 'public']
    },
    {
      id: 'list-paginated',
      title: 'List Paginated',
      description: 'Get paginated posts',
      method: 'GET',
      params: {
        limit: '{{limit}}',
        offset: '{{offset}}'
      },
      tags: ['read', 'list', 'public']
    },
    {
      id: 'list-featured',
      title: 'List Featured Posts',
      description: 'Get featured published posts',
      method: 'GET',
      params: {
        featured: 'true'
      },
      tags: ['read', 'filter', 'public']
    }
  ]
})
