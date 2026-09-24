/**
 * API Presets for Opportunities Entity
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  summary: 'Manage sales opportunities with pipeline tracking',
  presets: [
    {
      id: 'list-all',
      title: 'List All Opportunities',
      description: 'Get all opportunities with pagination',
      method: 'GET',
      params: {
        limit: 20
      },
      tags: ['read', 'list']
    },
    {
      id: 'list-open',
      title: 'List Open Opportunities',
      description: 'Get all open opportunities',
      method: 'GET',
      params: {
        status: 'open'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-won',
      title: 'List Won Opportunities',
      description: 'Get all won opportunities',
      method: 'GET',
      params: {
        status: 'won'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-by-company',
      title: 'List by Company',
      description: 'Get opportunities for a specific company',
      method: 'GET',
      params: {
        companyId: '{{companyId}}'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-by-pipeline',
      title: 'List by Pipeline',
      description: 'Get opportunities in a specific pipeline',
      method: 'GET',
      params: {
        pipelineId: '{{pipelineId}}'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-closing-soon',
      title: 'List Closing Soon',
      description: 'Get opportunities sorted by close date',
      method: 'GET',
      params: {
        status: 'open',
        sortBy: 'closeDate',
        sortOrder: 'asc'
      },
      tags: ['read', 'filter', 'priority']
    },
    {
      id: 'list-high-value',
      title: 'List High Value',
      description: 'Get opportunities sorted by amount',
      method: 'GET',
      params: {
        status: 'open',
        sortBy: 'amount',
        sortOrder: 'desc'
      },
      tags: ['read', 'filter', 'priority']
    },
    {
      id: 'create-opportunity',
      title: 'Create New Opportunity',
      description: 'Create an opportunity with sample data',
      method: 'POST',
      payload: {
        name: 'Sample Deal',
        companyId: '{{companyId}}',
        pipelineId: '{{pipelineId}}',
        stageId: 'discovery',
        amount: 10000,
        currency: 'USD',
        closeDate: '2024-12-31'
      },
      tags: ['write', 'create']
    },
    {
      id: 'update-stage',
      title: 'Update Stage',
      description: 'Move opportunity to a new stage',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        stageId: '{{newStageId}}'
      },
      tags: ['write', 'update']
    },
    {
      id: 'mark-won',
      title: 'Mark as Won',
      description: 'Mark opportunity as won',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        status: 'won'
      },
      tags: ['write', 'update']
    },
    {
      id: 'mark-lost',
      title: 'Mark as Lost',
      description: 'Mark opportunity as lost with reason',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        status: 'lost',
        lostReason: '{{reason}}'
      },
      tags: ['write', 'update']
    },
    {
      id: 'delete-opportunity',
      title: 'Delete Opportunity',
      description: 'Delete an opportunity record',
      method: 'DELETE',
      pathParams: {
        id: '{{id}}'
      },
      tags: ['write', 'delete']
    }
  ]
})
