/**
 * API Presets for OAuth Callback
 *
 * OAuth redirect handler - typically not called directly
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  endpoint: '/api/v1/plugin/social-media-publisher/social/connect/callback',
  summary: 'OAuth callback handler for social media connections (browser redirect)',
  presets: [
    {
      id: 'callback-success',
      title: 'Callback with Code',
      description: 'OAuth callback with authorization code (browser redirect)',
      method: 'GET',
      params: {
        code: '{{authorizationCode}}',
        state: '{{state}}&platform=instagram_business&clientId={{clientId}}'
      },
      tags: ['oauth', 'callback']
    },
    {
      id: 'callback-preview',
      title: 'Callback Preview Mode',
      description: 'OAuth callback in preview mode (returns data without saving)',
      method: 'GET',
      params: {
        code: '{{authorizationCode}}',
        state: '{{state}}&platform=instagram_business&clientId={{clientId}}&mode=preview'
      },
      tags: ['oauth', 'callback', 'preview']
    },
    {
      id: 'callback-error',
      title: 'Callback with Error',
      description: 'OAuth callback when user denies permission',
      method: 'GET',
      params: {
        error: 'access_denied',
        error_description: 'User cancelled the authorization'
      },
      tags: ['oauth', 'callback', 'error']
    }
  ]
})
