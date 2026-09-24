/**
 * API Presets for Boards Entity
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  summary: 'Manage kanban boards for task organization',
  presets: [
    {
      id: 'list-all',
      title: 'List All Boards',
      description: 'Get all boards with pagination',
      method: 'GET',
      params: {
        limit: 20
      },
      tags: ['read', 'list']
    },
    {
      id: 'list-active',
      title: 'List Active Boards',
      description: 'Get all non-archived boards',
      method: 'GET',
      params: {
        archived: 'false'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-archived',
      title: 'List Archived Boards',
      description: 'Get all archived boards',
      method: 'GET',
      params: {
        archived: 'true'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'search-by-name',
      title: 'Search by Name',
      description: 'Search boards by name',
      method: 'GET',
      params: {
        search: '{{name}}'
      },
      tags: ['read', 'search']
    },
    {
      id: 'create-board',
      title: 'Create Board',
      description: 'Create a new board',
      method: 'POST',
      payload: {
        name: 'New Board',
        description: 'Board description',
        color: 'blue'
      },
      tags: ['write', 'create']
    },
    {
      id: 'update-board',
      title: 'Update Board',
      description: 'Update an existing board',
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
      id: 'archive-board',
      title: 'Archive Board',
      description: 'Archive a board',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        archived: true
      },
      tags: ['write', 'update']
    },
    {
      id: 'restore-board',
      title: 'Restore Board',
      description: 'Restore an archived board',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        archived: false
      },
      tags: ['write', 'update']
    },
    {
      id: 'delete-board',
      title: 'Delete Board',
      description: 'Permanently delete a board',
      method: 'DELETE',
      pathParams: {
        id: '{{id}}'
      },
      tags: ['write', 'delete']
    }
  ]
})
