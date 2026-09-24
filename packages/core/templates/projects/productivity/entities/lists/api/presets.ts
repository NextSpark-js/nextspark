/**
 * API Presets for Lists Entity
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  summary: 'Manage kanban lists (columns) within boards',
  presets: [
    {
      id: 'list-all',
      title: 'List All Lists',
      description: 'Get all lists with pagination',
      method: 'GET',
      params: {
        limit: 50
      },
      tags: ['read', 'list']
    },
    {
      id: 'list-by-board',
      title: 'List by Board',
      description: 'Get all lists for a specific board',
      method: 'GET',
      params: {
        boardId: '{{boardId}}',
        sortBy: 'position',
        sortOrder: 'asc'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'create-list',
      title: 'Create List',
      description: 'Create a new list in a board',
      method: 'POST',
      payload: {
        name: 'New List',
        boardId: '{{boardId}}',
        position: 0
      },
      tags: ['write', 'create']
    },
    {
      id: 'rename-list',
      title: 'Rename List',
      description: 'Rename an existing list',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        name: '{{name}}'
      },
      tags: ['write', 'update']
    },
    {
      id: 'reorder-list',
      title: 'Reorder List',
      description: 'Update list position within board',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        position: '{{position}}'
      },
      tags: ['write', 'update']
    },
    {
      id: 'delete-list',
      title: 'Delete List',
      description: 'Delete a list and all its cards',
      method: 'DELETE',
      pathParams: {
        id: '{{id}}'
      },
      tags: ['write', 'delete']
    }
  ]
})
