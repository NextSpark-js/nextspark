/**
 * API Presets for Social Media Disconnect
 *
 * Disconnect (deactivate) social media accounts
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  endpoint: '/api/v1/plugin/social-media-publisher/social/disconnect',
  summary: 'Disconnect and deactivate social media accounts',
  presets: [
    {
      id: 'disconnect-post',
      title: 'Disconnect Account (POST)',
      description: 'Disconnect account using POST method',
      method: 'POST',
      payload: {
        accountId: '{{accountId}}'
      },
      tags: ['write', 'disconnect']
    },
    {
      id: 'disconnect-delete',
      title: 'Disconnect Account (DELETE)',
      description: 'Disconnect account using DELETE method with path param',
      method: 'DELETE',
      pathParams: {
        accountId: '{{accountId}}'
      },
      tags: ['write', 'disconnect']
    }
  ]
})
