/**
 * API Presets for AI Generate
 *
 * Generate AI text responses using multiple providers
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  endpoint: '/api/v1/plugin/ai/generate',
  summary: 'Generate AI text responses using OpenAI, Anthropic, or Ollama',
  presets: [
    {
      id: 'simple-prompt',
      title: 'Simple Prompt',
      description: 'Generate response with default settings',
      method: 'POST',
      payload: {
        prompt: 'Explain quantum computing in simple terms'
      },
      tags: ['write', 'ai']
    },
    {
      id: 'with-model',
      title: 'With Specific Model',
      description: 'Generate using a specific AI model',
      method: 'POST',
      payload: {
        prompt: '{{prompt}}',
        model: 'gpt-4o-mini'
      },
      tags: ['write', 'ai']
    },
    {
      id: 'creative-response',
      title: 'Creative Response',
      description: 'Generate with high temperature for creativity',
      method: 'POST',
      payload: {
        prompt: '{{prompt}}',
        temperature: 0.9,
        maxTokens: 1000
      },
      tags: ['write', 'ai']
    },
    {
      id: 'precise-response',
      title: 'Precise Response',
      description: 'Generate with low temperature for accuracy',
      method: 'POST',
      payload: {
        prompt: '{{prompt}}',
        temperature: 0.1,
        maxTokens: 500
      },
      tags: ['write', 'ai']
    },
    {
      id: 'save-example',
      title: 'Save as Example',
      description: 'Generate and save interaction for training',
      method: 'POST',
      payload: {
        prompt: '{{prompt}}',
        saveExample: true
      },
      tags: ['write', 'ai']
    },
    {
      id: 'local-model',
      title: 'Use Local Model',
      description: 'Generate using Ollama local model',
      method: 'POST',
      payload: {
        prompt: '{{prompt}}',
        model: 'llama3.2:3b'
      },
      tags: ['write', 'ai', 'local']
    },
    {
      id: 'get-endpoint-info',
      title: 'Get Endpoint Info',
      description: 'Get available models and configuration',
      method: 'GET',
      tags: ['read', 'info']
    }
  ]
})
