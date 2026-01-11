/**
 * API Presets for AI History
 *
 * Manage AI operation history and entity linking
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  endpoint: '/api/v1/plugin/ai/ai-history/:id',
  summary: 'Link AI history records to related entities',
  presets: [
    {
      id: 'link-to-client',
      title: 'Link to Client',
      description: 'Link AI history to a client entity',
      method: 'PATCH',
      pathParams: {
        id: '{{historyId}}'
      },
      payload: {
        relatedEntityType: 'clients',
        relatedEntityId: '{{clientId}}'
      },
      tags: ['write', 'update']
    },
    {
      id: 'link-to-project',
      title: 'Link to Project',
      description: 'Link AI history to a project entity',
      method: 'PATCH',
      pathParams: {
        id: '{{historyId}}'
      },
      payload: {
        relatedEntityType: 'projects',
        relatedEntityId: '{{projectId}}'
      },
      tags: ['write', 'update']
    },
    {
      id: 'link-to-entity',
      title: 'Link to Entity',
      description: 'Link AI history to any entity type',
      method: 'PATCH',
      pathParams: {
        id: '{{historyId}}'
      },
      payload: {
        relatedEntityType: '{{entityType}}',
        relatedEntityId: '{{entityId}}'
      },
      tags: ['write', 'update']
    }
  ]
})
