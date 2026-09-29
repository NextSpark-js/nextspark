/**
 * API Presets for Cron
 *
 * These presets appear in the DevTools API Explorer's "Presets" tab.
 * Note: These require CRON_SECRET header which should be configured in environment.
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  endpoint: '/api/v1/cron',
  summary: 'Process scheduled actions via cron',
  presets: [
    {
      id: 'process-actions',
      title: 'Process Scheduled Actions',
      description: 'Process pending actions (requires CRON_SECRET header)',
      method: 'GET',
      path: '/process',
      headers: {
        'x-cron-secret': '{{CRON_SECRET}}'
      },
      tags: ['write', 'cron']
    }
  ]
})
