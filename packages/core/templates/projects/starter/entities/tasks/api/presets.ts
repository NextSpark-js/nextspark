/**
 * API Presets for Tasks Entity
 *
 * These presets appear in the DevTools API Explorer's "Presets" tab.
 * The endpoint is automatically derived from the entity name: /api/v1/tasks
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  summary: 'Manage tasks with status and priorities',
  presets: [
    {
      id: 'list-all',
      title: 'List All Tasks',
      description: 'Fetch all tasks with default pagination',
      method: 'GET',
      params: {
        limit: 10,
        offset: 0
      },
      tags: ['read', 'list']
    },
    {
      id: 'list-todo',
      title: 'List To-Do Tasks',
      description: 'Fetch tasks in to-do status',
      method: 'GET',
      params: {
        status: 'todo',
        limit: 20
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-in-progress',
      title: 'List In Progress',
      description: 'Fetch tasks currently in progress',
      method: 'GET',
      params: {
        status: 'in-progress',
        limit: 20
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-urgent',
      title: 'List Urgent Tasks',
      description: 'Fetch high priority and urgent tasks',
      method: 'GET',
      params: {
        priority: 'urgent',
        sortBy: 'dueDate',
        sortOrder: 'asc'
      },
      tags: ['read', 'filter', 'priority']
    },
    {
      id: 'create-task',
      title: 'Create New Task',
      description: 'Create a new task with sample data',
      method: 'POST',
      payload: {
        title: 'New Task',
        description: 'Task description here',
        status: 'todo',
        priority: 'medium',
        tags: ['development']
      },
      tags: ['write', 'create']
    },
    {
      id: 'search-title',
      title: 'Search by Title',
      description: 'Search tasks by title',
      method: 'GET',
      params: {
        search: 'feature',
        searchField: 'title'
      },
      tags: ['read', 'search']
    }
  ]
})
