/**
 * API Presets for Authors Route
 *
 * Public author profiles and their published posts
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  endpoint: '/api/v1/theme/blog/authors',
  summary: 'Public author profiles with published posts',
  presets: [
    {
      id: 'list-all',
      title: 'List All Authors',
      description: 'Get all authors with published posts',
      method: 'GET',
      params: {
        limit: 50
      },
      tags: ['read', 'list', 'public']
    },
    {
      id: 'get-by-username',
      title: 'Get Author by Username',
      description: 'Get author profile with their posts',
      method: 'GET',
      pathParams: {
        username: '{{username}}'
      },
      tags: ['read', 'detail', 'public']
    },
    {
      id: 'list-with-post-count',
      title: 'List with Post Count',
      description: 'Get authors sorted by number of posts',
      method: 'GET',
      params: {
        sortBy: 'postCount',
        sortOrder: 'desc'
      },
      tags: ['read', 'list', 'public']
    }
  ]
})
