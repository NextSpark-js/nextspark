/**
 * API Presets for Posts Entity
 *
 * These presets appear in the DevTools API Explorer's "Presets" tab.
 * The endpoint is automatically derived from the entity name: /api/v1/posts
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  summary: 'Manage blog posts with builder and taxonomies',
  presets: [
    {
      id: 'list-all',
      title: 'List All Posts',
      description: 'Fetch all posts with default pagination',
      method: 'GET',
      params: {
        limit: 10,
        offset: 0
      },
      tags: ['read', 'list']
    },
    {
      id: 'list-published',
      title: 'List Published Posts',
      description: 'Fetch only published posts',
      method: 'GET',
      params: {
        status: 'published',
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      },
      tags: ['read', 'filter', 'public']
    },
    {
      id: 'list-drafts',
      title: 'List Draft Posts',
      description: 'Fetch posts in draft status',
      method: 'GET',
      params: {
        status: 'draft',
        limit: 20
      },
      tags: ['read', 'filter']
    },
    {
      id: 'create-draft',
      title: 'Create Draft Post',
      description: 'Create a new post as draft',
      method: 'POST',
      payload: {
        title: 'My New Blog Post',
        slug: 'my-new-blog-post',
        status: 'draft',
        excerpt: 'A brief introduction to my post',
        blocks: []
      },
      tags: ['write', 'create']
    },
    {
      id: 'search-title',
      title: 'Search by Title',
      description: 'Search posts by title',
      method: 'GET',
      params: {
        search: 'NextSpark',
        searchField: 'title'
      },
      tags: ['read', 'search']
    }
  ]
})
