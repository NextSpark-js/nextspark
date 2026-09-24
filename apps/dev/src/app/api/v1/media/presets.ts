/**
 * API Presets for Media
 *
 * These presets appear in the DevTools API Explorer's "Presets" tab.
 * Note: File upload presets cannot include actual files.
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  endpoint: '/api/v1/media',
  summary: 'Upload and manage media files',
  presets: [
    // Get upload info
    {
      id: 'get-upload-info',
      title: 'Get Upload Info',
      description: 'Get media upload endpoint configuration',
      method: 'GET',
      path: '/upload',
      tags: ['read', 'info']
    }
  ]
})
