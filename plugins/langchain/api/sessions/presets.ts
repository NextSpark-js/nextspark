/**
 * API Presets for LangChain Sessions
 *
 * Predefined API calls for conversation management.
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  summary: 'Manage AI conversation sessions',
  presets: [
    {
      id: 'list-all',
      title: 'List All Conversations',
      description: 'Get all conversations for the current user',
      method: 'GET',
      headers: {
        'x-team-id': '{{teamId}}'
      },
      tags: ['read', 'list']
    },
    {
      id: 'get-by-id',
      title: 'Get Conversation by ID',
      description: 'Get a specific conversation by its session ID',
      method: 'GET',
      params: {
        id: '{{sessionId}}'
      },
      headers: {
        'x-team-id': '{{teamId}}'
      },
      tags: ['read', 'detail']
    },
    {
      id: 'create-new',
      title: 'Create New Conversation',
      description: 'Create a new AI conversation session',
      method: 'POST',
      headers: {
        'x-team-id': '{{teamId}}'
      },
      payload: {
        name: 'New Conversation'
      },
      tags: ['write', 'create']
    },
    {
      id: 'rename-conversation',
      title: 'Rename Conversation',
      description: 'Update the name of an existing conversation',
      method: 'PATCH',
      headers: {
        'x-team-id': '{{teamId}}'
      },
      payload: {
        sessionId: '{{sessionId}}',
        name: '{{newName}}'
      },
      tags: ['write', 'update']
    },
    {
      id: 'pin-conversation',
      title: 'Pin Conversation',
      description: 'Pin a conversation to keep it at the top',
      method: 'PATCH',
      headers: {
        'x-team-id': '{{teamId}}'
      },
      payload: {
        sessionId: '{{sessionId}}',
        isPinned: true
      },
      tags: ['write', 'update']
    },
    {
      id: 'unpin-conversation',
      title: 'Unpin Conversation',
      description: 'Unpin a conversation',
      method: 'PATCH',
      headers: {
        'x-team-id': '{{teamId}}'
      },
      payload: {
        sessionId: '{{sessionId}}',
        isPinned: false
      },
      tags: ['write', 'update']
    },
    {
      id: 'delete-conversation',
      title: 'Delete Conversation',
      description: 'Delete a conversation and all its message history',
      method: 'DELETE',
      headers: {
        'x-team-id': '{{teamId}}'
      },
      payload: {
        sessionId: '{{sessionId}}'
      },
      tags: ['write', 'delete']
    }
  ]
})
