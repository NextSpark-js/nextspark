/**
 * API Presets for Posts Entity
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  summary: 'Manage blog posts with content builder and publication workflow',
  presets: [
    {
      id: 'list-all',
      title: 'List All Posts',
      description: 'Get all posts with pagination',
      method: 'GET',
      params: {
        limit: 20
      },
      tags: ['read', 'list']
    },
    {
      id: 'list-published',
      title: 'List Published Posts',
      description: 'Get all published posts',
      method: 'GET',
      params: {
        status: 'published'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-drafts',
      title: 'List Draft Posts',
      description: 'Get all draft posts',
      method: 'GET',
      params: {
        status: 'draft'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-featured',
      title: 'List Featured Posts',
      description: 'Get all featured posts',
      method: 'GET',
      params: {
        featured: 'true'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'search-by-title',
      title: 'Search by Title',
      description: 'Search posts by title',
      method: 'GET',
      params: {
        search: '{{title}}'
      },
      tags: ['read', 'search']
    },
    {
      id: 'create-draft',
      title: 'Create Draft Post',
      description: 'Create a new draft post',
      method: 'POST',
      payload: {
        title: 'New Post Title',
        slug: 'new-post-title',
        excerpt: 'Brief description of the post',
        status: 'draft'
      },
      tags: ['write', 'create']
    },
    {
      id: 'publish-post',
      title: 'Publish Post',
      description: 'Publish a draft post',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        status: 'published',
        publishedAt: '{{publishedAt}}'
      },
      tags: ['write', 'update']
    },
    {
      id: 'unpublish-post',
      title: 'Unpublish Post',
      description: 'Revert a post to draft',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        status: 'draft'
      },
      tags: ['write', 'update']
    },
    {
      id: 'set-featured',
      title: 'Set as Featured',
      description: 'Mark a post as featured',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        featured: true
      },
      tags: ['write', 'update']
    },
    {
      id: 'update-content',
      title: 'Update Content',
      description: 'Update post content blocks',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        content: '{{content}}'
      },
      tags: ['write', 'update']
    },
    {
      id: 'delete-post',
      title: 'Delete Post',
      description: 'Delete a post record',
      method: 'DELETE',
      pathParams: {
        id: '{{id}}'
      },
      tags: ['write', 'delete']
    }
  ]
})
