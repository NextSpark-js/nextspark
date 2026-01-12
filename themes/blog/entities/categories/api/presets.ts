/**
 * API Presets for Categories Entity
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  summary: 'Manage blog categories for organizing posts',
  presets: [
    {
      id: 'list-all',
      title: 'List All Categories',
      description: 'Get all categories with pagination',
      method: 'GET',
      params: {
        limit: 50
      },
      tags: ['read', 'list']
    },
    {
      id: 'search-by-name',
      title: 'Search by Name',
      description: 'Search categories by name',
      method: 'GET',
      params: {
        search: '{{name}}'
      },
      tags: ['read', 'search']
    },
    {
      id: 'create-category',
      title: 'Create Category',
      description: 'Create a new category',
      method: 'POST',
      payload: {
        name: 'New Category',
        slug: 'new-category',
        description: 'Category description'
      },
      tags: ['write', 'create']
    },
    {
      id: 'update-category',
      title: 'Update Category',
      description: 'Update an existing category',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        name: '{{name}}',
        description: '{{description}}'
      },
      tags: ['write', 'update']
    },
    {
      id: 'delete-category',
      title: 'Delete Category',
      description: 'Delete a category record',
      method: 'DELETE',
      pathParams: {
        id: '{{id}}'
      },
      tags: ['write', 'delete']
    }
  ]
})
