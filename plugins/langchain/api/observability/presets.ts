/**
 * API Presets for LangChain Observability
 *
 * Predefined API calls for traces and metrics monitoring.
 * Admin access required (superadmin or developer roles).
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  summary: 'Monitor AI traces and performance metrics',
  presets: [
    {
      id: 'list-traces',
      title: 'List Recent Traces',
      description: 'Get the most recent AI agent traces',
      method: 'GET',
      params: {
        limit: 50
      },
      tags: ['read', 'list', 'traces']
    },
    {
      id: 'list-running',
      title: 'List Running Traces',
      description: 'Get all currently running agent traces',
      method: 'GET',
      params: {
        status: 'running',
        limit: 50
      },
      tags: ['read', 'filter', 'traces']
    },
    {
      id: 'list-success',
      title: 'List Successful Traces',
      description: 'Get completed successful traces',
      method: 'GET',
      params: {
        status: 'success',
        limit: 50
      },
      tags: ['read', 'filter', 'traces']
    },
    {
      id: 'list-errors',
      title: 'List Error Traces',
      description: 'Get traces that ended with an error',
      method: 'GET',
      params: {
        status: 'error',
        limit: 50
      },
      tags: ['read', 'filter', 'traces']
    },
    {
      id: 'list-by-agent',
      title: 'List by Agent',
      description: 'Filter traces by a specific agent name',
      method: 'GET',
      params: {
        agent: '{{agentName}}',
        limit: 50
      },
      tags: ['read', 'filter', 'traces']
    },
    {
      id: 'list-by-team',
      title: 'List by Team',
      description: 'Filter traces for a specific team',
      method: 'GET',
      params: {
        teamId: '{{teamId}}',
        limit: 50
      },
      tags: ['read', 'filter', 'traces']
    },
    {
      id: 'list-by-date-range',
      title: 'List by Date Range',
      description: 'Filter traces within a specific time period',
      method: 'GET',
      params: {
        from: '{{fromDate}}',
        to: '{{toDate}}',
        limit: 50
      },
      tags: ['read', 'filter', 'traces']
    },
    {
      id: 'get-trace-detail',
      title: 'Get Trace Detail',
      description: 'Get detailed information about a specific trace including spans',
      method: 'GET',
      pathParams: {
        traceId: '{{traceId}}'
      },
      tags: ['read', 'detail', 'traces']
    },
    {
      id: 'get-metrics-1h',
      title: 'Get Metrics (1 Hour)',
      description: 'Get aggregated metrics for the last hour',
      method: 'GET',
      params: {
        period: '1h'
      },
      tags: ['read', 'metrics']
    },
    {
      id: 'get-metrics-24h',
      title: 'Get Metrics (24 Hours)',
      description: 'Get aggregated metrics for the last 24 hours',
      method: 'GET',
      params: {
        period: '24h'
      },
      tags: ['read', 'metrics']
    },
    {
      id: 'get-metrics-7d',
      title: 'Get Metrics (7 Days)',
      description: 'Get aggregated metrics for the last 7 days',
      method: 'GET',
      params: {
        period: '7d'
      },
      tags: ['read', 'metrics']
    },
    {
      id: 'get-metrics-30d',
      title: 'Get Metrics (30 Days)',
      description: 'Get aggregated metrics for the last 30 days',
      method: 'GET',
      params: {
        period: '30d'
      },
      tags: ['read', 'metrics']
    }
  ]
})
