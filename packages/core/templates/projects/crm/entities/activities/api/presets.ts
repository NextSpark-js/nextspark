/**
 * API Presets for Activities Entity
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  summary: 'Track calls, meetings, tasks, and emails',
  presets: [
    {
      id: 'list-all',
      title: 'List All Activities',
      description: 'Get all activities with pagination',
      method: 'GET',
      params: {
        limit: 20
      },
      tags: ['read', 'list']
    },
    {
      id: 'list-upcoming',
      title: 'List Upcoming',
      description: 'Get scheduled activities sorted by due date',
      method: 'GET',
      params: {
        status: 'scheduled',
        sortBy: 'dueDate',
        sortOrder: 'asc'
      },
      tags: ['read', 'filter', 'priority']
    },
    {
      id: 'list-overdue',
      title: 'List Overdue',
      description: 'Get overdue activities',
      method: 'GET',
      params: {
        status: 'overdue'
      },
      tags: ['read', 'filter', 'priority']
    },
    {
      id: 'list-by-type',
      title: 'List by Type',
      description: 'Get activities of a specific type',
      method: 'GET',
      params: {
        type: '{{type}}'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-by-contact',
      title: 'List by Contact',
      description: 'Get activities for a specific contact',
      method: 'GET',
      params: {
        contactId: '{{contactId}}'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-by-company',
      title: 'List by Company',
      description: 'Get activities for a specific company',
      method: 'GET',
      params: {
        companyId: '{{companyId}}'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-by-opportunity',
      title: 'List by Opportunity',
      description: 'Get activities for a specific opportunity',
      method: 'GET',
      params: {
        opportunityId: '{{opportunityId}}'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'create-call',
      title: 'Create Call',
      description: 'Create a new call activity',
      method: 'POST',
      payload: {
        type: 'call',
        subject: 'Follow-up call',
        status: 'scheduled',
        priority: 'medium'
      },
      tags: ['write', 'create']
    },
    {
      id: 'create-meeting',
      title: 'Create Meeting',
      description: 'Create a new meeting activity',
      method: 'POST',
      payload: {
        type: 'meeting',
        subject: 'Meeting',
        status: 'scheduled',
        duration: 60
      },
      tags: ['write', 'create']
    },
    {
      id: 'mark-completed',
      title: 'Mark Completed',
      description: 'Mark an activity as completed',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        status: 'completed'
      },
      tags: ['write', 'update']
    },
    {
      id: 'delete-activity',
      title: 'Delete Activity',
      description: 'Delete an activity record',
      method: 'DELETE',
      pathParams: {
        id: '{{id}}'
      },
      tags: ['write', 'delete']
    }
  ]
})
