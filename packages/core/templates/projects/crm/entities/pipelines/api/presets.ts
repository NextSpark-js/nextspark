/**
 * API Presets for Pipelines Entity
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  summary: 'Manage sales pipelines with customizable stages',
  presets: [
    {
      id: 'list-all',
      title: 'List All Pipelines',
      description: 'Get all pipelines',
      method: 'GET',
      params: {
        limit: 20
      },
      tags: ['read', 'list']
    },
    {
      id: 'list-active',
      title: 'List Active Pipelines',
      description: 'Get all active pipelines',
      method: 'GET',
      params: {
        isActive: 'true'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-by-type',
      title: 'List by Type',
      description: 'Get pipelines of a specific type',
      method: 'GET',
      params: {
        type: '{{type}}'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'get-default',
      title: 'Get Default Pipeline',
      description: 'Get the default pipeline',
      method: 'GET',
      params: {
        isDefault: 'true'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'create-sales-pipeline',
      title: 'Create Sales Pipeline',
      description: 'Create a new sales pipeline with default stages',
      method: 'POST',
      payload: {
        name: 'Sales Pipeline',
        type: 'sales',
        isActive: true,
        stages: [
          { id: 'discovery', name: 'Discovery', probability: 10, order: 1 },
          { id: 'proposal', name: 'Proposal', probability: 30, order: 2 },
          { id: 'negotiation', name: 'Negotiation', probability: 60, order: 3 },
          { id: 'won', name: 'Won', probability: 100, order: 4 }
        ]
      },
      tags: ['write', 'create']
    },
    {
      id: 'update-stages',
      title: 'Update Stages',
      description: 'Update the stages of a pipeline',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        stages: '{{stages}}'
      },
      tags: ['write', 'update']
    },
    {
      id: 'set-default',
      title: 'Set as Default',
      description: 'Set a pipeline as the default',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        isDefault: true
      },
      tags: ['write', 'update']
    },
    {
      id: 'deactivate',
      title: 'Deactivate Pipeline',
      description: 'Deactivate a pipeline',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        isActive: false
      },
      tags: ['write', 'update']
    },
    {
      id: 'delete-pipeline',
      title: 'Delete Pipeline',
      description: 'Delete a pipeline',
      method: 'DELETE',
      pathParams: {
        id: '{{id}}'
      },
      tags: ['write', 'delete']
    }
  ]
})
