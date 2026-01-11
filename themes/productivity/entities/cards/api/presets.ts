/**
 * API Presets for Cards Entity
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  summary: 'Manage kanban cards (tasks) with priorities and assignments',
  presets: [
    {
      id: 'list-all',
      title: 'List All Cards',
      description: 'Get all cards with pagination',
      method: 'GET',
      params: {
        limit: 50
      },
      tags: ['read', 'list']
    },
    {
      id: 'list-by-list',
      title: 'List by List',
      description: 'Get all cards for a specific list',
      method: 'GET',
      params: {
        listId: '{{listId}}',
        sortBy: 'position',
        sortOrder: 'asc'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-by-board',
      title: 'List by Board',
      description: 'Get all cards for a specific board',
      method: 'GET',
      params: {
        boardId: '{{boardId}}'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-my-cards',
      title: 'List My Cards',
      description: 'Get cards assigned to current user',
      method: 'GET',
      params: {
        assigneeId: '{{userId}}'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-urgent',
      title: 'List Urgent Cards',
      description: 'Get all urgent priority cards',
      method: 'GET',
      params: {
        priority: 'urgent'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-by-priority',
      title: 'List by Priority',
      description: 'Get cards filtered by priority level',
      method: 'GET',
      params: {
        priority: '{{priority}}'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'search-by-title',
      title: 'Search by Title',
      description: 'Search cards by title',
      method: 'GET',
      params: {
        search: '{{title}}'
      },
      tags: ['read', 'search']
    },
    {
      id: 'create-card',
      title: 'Create Card',
      description: 'Create a new card in a list',
      method: 'POST',
      payload: {
        title: 'New Card',
        listId: '{{listId}}',
        boardId: '{{boardId}}'
      },
      tags: ['write', 'create']
    },
    {
      id: 'update-card',
      title: 'Update Card',
      description: 'Update card title and description',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        title: '{{title}}',
        description: '{{description}}'
      },
      tags: ['write', 'update']
    },
    {
      id: 'move-card',
      title: 'Move Card',
      description: 'Move card to a different list',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        listId: '{{newListId}}',
        position: '{{position}}'
      },
      tags: ['write', 'update']
    },
    {
      id: 'set-priority',
      title: 'Set Priority',
      description: 'Update card priority level',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        priority: '{{priority}}'
      },
      tags: ['write', 'update']
    },
    {
      id: 'assign-card',
      title: 'Assign Card',
      description: 'Assign card to a team member',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        assigneeId: '{{userId}}'
      },
      tags: ['write', 'update']
    },
    {
      id: 'set-due-date',
      title: 'Set Due Date',
      description: 'Set or update card due date',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        dueDate: '{{dueDate}}'
      },
      tags: ['write', 'update']
    },
    {
      id: 'delete-card',
      title: 'Delete Card',
      description: 'Delete a card',
      method: 'DELETE',
      pathParams: {
        id: '{{id}}'
      },
      tags: ['write', 'delete']
    }
  ]
})
