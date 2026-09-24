/**
 * API Presets for Notes Entity
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  summary: 'Manage notes linked to contacts, companies, and opportunities',
  presets: [
    {
      id: 'list-all',
      title: 'List All Notes',
      description: 'Get all notes with pagination',
      method: 'GET',
      params: {
        limit: 20
      },
      tags: ['read', 'list']
    },
    {
      id: 'list-pinned',
      title: 'List Pinned Notes',
      description: 'Get all pinned notes',
      method: 'GET',
      params: {
        isPinned: 'true'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-by-type',
      title: 'List by Type',
      description: 'Get notes of a specific type',
      method: 'GET',
      params: {
        type: '{{type}}'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-by-contact',
      title: 'List by Contact',
      description: 'Get notes for a specific contact',
      method: 'GET',
      params: {
        contactId: '{{contactId}}'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-by-company',
      title: 'List by Company',
      description: 'Get notes for a specific company',
      method: 'GET',
      params: {
        companyId: '{{companyId}}'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-by-opportunity',
      title: 'List by Opportunity',
      description: 'Get notes for a specific opportunity',
      method: 'GET',
      params: {
        opportunityId: '{{opportunityId}}'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'search-notes',
      title: 'Search Notes',
      description: 'Search notes by content',
      method: 'GET',
      params: {
        search: '{{searchTerm}}'
      },
      tags: ['read', 'search']
    },
    {
      id: 'create-note',
      title: 'Create Note',
      description: 'Create a new note',
      method: 'POST',
      payload: {
        content: 'Note content here...',
        type: 'general'
      },
      tags: ['write', 'create']
    },
    {
      id: 'pin-note',
      title: 'Pin Note',
      description: 'Pin a note',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        isPinned: true
      },
      tags: ['write', 'update']
    },
    {
      id: 'delete-note',
      title: 'Delete Note',
      description: 'Delete a note record',
      method: 'DELETE',
      pathParams: {
        id: '{{id}}'
      },
      tags: ['write', 'delete']
    }
  ]
})
