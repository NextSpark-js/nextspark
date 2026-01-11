/**
 * API Presets for AI Embeddings
 *
 * Generate text embeddings using OpenAI
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  endpoint: '/api/v1/plugin/ai/embeddings',
  summary: 'Generate text embeddings using OpenAI text-embedding-3-small model',
  presets: [
    {
      id: 'generate-embedding',
      title: 'Generate Embedding',
      description: 'Convert text to vector representation',
      method: 'POST',
      payload: {
        text: 'Premium wireless headphones with noise cancellation'
      },
      tags: ['write', 'ai']
    },
    {
      id: 'generate-long-text',
      title: 'Embed Long Text',
      description: 'Generate embedding for longer content',
      method: 'POST',
      payload: {
        text: '{{longText}}'
      },
      tags: ['write', 'ai']
    },
    {
      id: 'get-endpoint-info',
      title: 'Get Endpoint Info',
      description: 'Get embedding endpoint documentation',
      method: 'GET',
      tags: ['read', 'info']
    }
  ]
})
