/**
 * API Presets for Social Media Connect
 *
 * OAuth connection for Facebook Pages and Instagram Business
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  endpoint: '/api/v1/plugin/social-media-publisher/social/connect',
  summary: 'Connect Facebook Pages and Instagram Business accounts via OAuth',
  presets: [
    {
      id: 'connect-instagram',
      title: 'Connect Instagram',
      description: 'Initiate OAuth for Instagram Business',
      method: 'GET',
      params: {
        platform: 'instagram_business',
        clientId: '{{clientId}}'
      },
      tags: ['oauth', 'instagram']
    },
    {
      id: 'connect-facebook',
      title: 'Connect Facebook',
      description: 'Initiate OAuth for Facebook Page',
      method: 'GET',
      params: {
        platform: 'facebook_page',
        clientId: '{{clientId}}'
      },
      tags: ['oauth', 'facebook']
    },
    {
      id: 'preview-mode',
      title: 'Preview Mode',
      description: 'Get account data without saving',
      method: 'GET',
      params: {
        platform: '{{platform}}',
        clientId: '{{clientId}}',
        mode: 'preview'
      },
      tags: ['oauth', 'preview']
    }
  ]
})
