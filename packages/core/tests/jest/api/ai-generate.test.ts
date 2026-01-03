/**
 * Integration Tests: AI Generate Endpoint
 * Tests AI generate endpoint with saveExample flag
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { NextRequest } from 'next/server'
import { POST, GET } from '@/contents/plugins/ai/api/generate/route'

// Mock dual authentication
jest.mock('@/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: jest.fn()
}))

// Mock AI SDK
jest.mock('ai', () => ({
  generateText: jest.fn()
}))

// Mock plugin utils
jest.mock('@/contents/plugins/ai/lib/core-utils', () => ({
  selectModel: jest.fn(),
  calculateCost: jest.fn(),
  validatePlugin: jest.fn(),
  extractTokens: jest.fn(),
  handleAIError: jest.fn()
}))

// Mock server env
jest.mock('@/contents/plugins/ai/lib/server-env', () => ({
  getServerPluginConfig: jest.fn()
}))

// Mock save example
jest.mock('@/contents/plugins/ai/lib/save-example', () => ({
  saveExampleSafely: jest.fn()
}))

import { authenticateRequest } from '@/core/lib/api/auth/dual-auth'
import { generateText } from 'ai'
import {
  selectModel,
  calculateCost,
  validatePlugin,
  extractTokens,
  handleAIError
} from '@/contents/plugins/ai/lib/core-utils'
import { getServerPluginConfig } from '@/contents/plugins/ai/lib/server-env'
import { saveExampleSafely } from '@/contents/plugins/ai/lib/save-example'

const mockAuthenticateRequest = authenticateRequest as jest.MockedFunction<typeof authenticateRequest>
const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>
const mockSelectModel = selectModel as jest.MockedFunction<typeof selectModel>
const mockCalculateCost = calculateCost as jest.MockedFunction<typeof calculateCost>
const mockValidatePlugin = validatePlugin as jest.MockedFunction<typeof validatePlugin>
const mockExtractTokens = extractTokens as jest.MockedFunction<typeof extractTokens>
const mockHandleAIError = handleAIError as jest.MockedFunction<typeof handleAIError>
const mockGetServerPluginConfig = getServerPluginConfig as jest.MockedFunction<typeof getServerPluginConfig>
const mockSaveExampleSafely = saveExampleSafely as jest.MockedFunction<typeof saveExampleSafely>

describe('AI Generate Endpoint - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Default successful mocks
    mockAuthenticateRequest.mockResolvedValue({
      success: true,
      user: { id: 'user-123', email: 'test@example.com' }
    } as any)

    mockValidatePlugin.mockResolvedValue({ valid: true })

    mockGetServerPluginConfig.mockResolvedValue({
      defaultModel: 'gpt-4o-mini',
      maxTokens: 4000,
      defaultTemperature: 0.7,
      ollamaDefaultModel: 'llama3.2:3b'
    } as any)

    mockSelectModel.mockResolvedValue({
      model: {} as any,
      modelName: 'gpt-4o-mini',
      provider: 'openai',
      isLocal: false,
      costConfig: { input: 0.00015, output: 0.0006 }
    })

    mockGenerateText.mockResolvedValue({
      text: 'This is a test AI response',
      usage: { promptTokens: 10, completionTokens: 20 }
    } as any)

    mockExtractTokens.mockReturnValue({ input: 10, output: 20, total: 30 })
    mockCalculateCost.mockReturnValue(0.0001)
    mockHandleAIError.mockReturnValue({
      error: 'Internal error',
      message: 'An error occurred',
      status: 500
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/plugin/ai/generate', () => {
    describe('Authentication', () => {
      test('should reject unauthenticated requests', async () => {
        mockAuthenticateRequest.mockResolvedValueOnce({
          success: false,
          error: 'No authentication provided'
        } as any)

        const request = new NextRequest('http://localhost/api/plugin/ai/generate', {
          method: 'POST',
          body: JSON.stringify({ prompt: 'Test' })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.error).toBe('Authentication required')
      })

      test('should accept authenticated requests', async () => {
        const request = new NextRequest('http://localhost/api/plugin/ai/generate', {
          method: 'POST',
          body: JSON.stringify({ prompt: 'What is AI?' })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(mockAuthenticateRequest).toHaveBeenCalled()
      })
    })

    describe('Plugin Validation', () => {
      test('should reject requests when plugin is not available', async () => {
        mockValidatePlugin.mockResolvedValueOnce({
          valid: false,
          error: 'Plugin not configured'
        })

        const request = new NextRequest('http://localhost/api/plugin/ai/generate', {
          method: 'POST',
          body: JSON.stringify({ prompt: 'Test' })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(503)
        expect(data.error).toBe('Plugin not configured')
      })
    })

    describe('Request Validation', () => {
      test('should reject empty prompt', async () => {
        const request = new NextRequest('http://localhost/api/plugin/ai/generate', {
          method: 'POST',
          body: JSON.stringify({ prompt: '' })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Validation failed')
        expect(data.details).toBeDefined()
      })

      test('should reject prompt that is too long', async () => {
        const longPrompt = 'x'.repeat(10001)
        const request = new NextRequest('http://localhost/api/plugin/ai/generate', {
          method: 'POST',
          body: JSON.stringify({ prompt: longPrompt })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Validation failed')
      })

      test('should accept valid prompt', async () => {
        const request = new NextRequest('http://localhost/api/plugin/ai/generate', {
          method: 'POST',
          body: JSON.stringify({ prompt: 'What is AI?' })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
      })

      test('should validate temperature range', async () => {
        const requestLow = new NextRequest('http://localhost/api/plugin/ai/generate', {
          method: 'POST',
          body: JSON.stringify({ prompt: 'Test', temperature: -0.1 })
        })

        const responseLow = await POST(requestLow)
        const dataLow = await responseLow.json()

        expect(responseLow.status).toBe(400)
        expect(dataLow.error).toBe('Validation failed')

        const requestHigh = new NextRequest('http://localhost/api/plugin/ai/generate', {
          method: 'POST',
          body: JSON.stringify({ prompt: 'Test', temperature: 1.1 })
        })

        const responseHigh = await POST(requestHigh)
        const dataHigh = await responseHigh.json()

        expect(responseHigh.status).toBe(400)
        expect(dataHigh.error).toBe('Validation failed')
      })

      test('should validate maxTokens range', async () => {
        const request = new NextRequest('http://localhost/api/plugin/ai/generate', {
          method: 'POST',
          body: JSON.stringify({ prompt: 'Test', maxTokens: 0 })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Validation failed')
      })
    })

    describe('AI Generation', () => {
      test('should generate AI response successfully', async () => {
        const request = new NextRequest('http://localhost/api/plugin/ai/generate', {
          method: 'POST',
          body: JSON.stringify({ prompt: 'What is AI?' })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.response).toBe('This is a test AI response')
        expect(data.model).toBe('gpt-4o-mini')
        expect(data.provider).toBe('openai')
        expect(data.isLocal).toBe(false)
        expect(data.tokens).toEqual({ input: 10, output: 20, total: 30 })
        expect(data.cost).toBe(0.0001)
        expect(data.userId).toBe('user-123')
      })

      test('should use default model if not specified', async () => {
        const request = new NextRequest('http://localhost/api/plugin/ai/generate', {
          method: 'POST',
          body: JSON.stringify({ prompt: 'Test' })
        })

        await POST(request)

        expect(mockSelectModel).toHaveBeenCalledWith('gpt-4o-mini')
      })

      test('should use custom model if specified', async () => {
        const request = new NextRequest('http://localhost/api/plugin/ai/generate', {
          method: 'POST',
          body: JSON.stringify({ prompt: 'Test', model: 'gpt-4' })
        })

        await POST(request)

        expect(mockSelectModel).toHaveBeenCalledWith('gpt-4')
      })

      test('should pass custom parameters to AI', async () => {
        const request = new NextRequest('http://localhost/api/plugin/ai/generate', {
          method: 'POST',
          body: JSON.stringify({
            prompt: 'Test',
            maxTokens: 1000,
            temperature: 0.5
          })
        })

        await POST(request)

        expect(mockGenerateText).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt: 'Test',
            maxOutputTokens: 1000,
            temperature: 0.5
          })
        )
      })

      test('should handle AI generation errors', async () => {
        mockGenerateText.mockRejectedValueOnce(new Error('API rate limit exceeded'))
        mockHandleAIError.mockReturnValueOnce({
          error: 'Rate limit exceeded',
          message: 'Too many requests',
          status: 429
        })

        const request = new NextRequest('http://localhost/api/plugin/ai/generate', {
          method: 'POST',
          body: JSON.stringify({ prompt: 'Test' })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(429)
        expect(data.error).toBe('Rate limit exceeded')
      })
    })

    describe('Example Saving - saveExample Flag', () => {
      test('should NOT save example by default (opt-in)', async () => {
        const request = new NextRequest('http://localhost/api/plugin/ai/generate', {
          method: 'POST',
          body: JSON.stringify({ prompt: 'Test prompt' })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.exampleSaved).toBe(false)
        expect(mockSaveExampleSafely).not.toHaveBeenCalled()
      })

      test('should NOT save example when saveExample is false', async () => {
        const request = new NextRequest('http://localhost/api/plugin/ai/generate', {
          method: 'POST',
          body: JSON.stringify({ prompt: 'Test prompt', saveExample: false })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.exampleSaved).toBe(false)
        expect(mockSaveExampleSafely).not.toHaveBeenCalled()
      })

      test('should save example when saveExample is true', async () => {
        const request = new NextRequest('http://localhost/api/plugin/ai/generate', {
          method: 'POST',
          body: JSON.stringify({
            prompt: 'What is quantum computing?',
            saveExample: true
          })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.exampleSaved).toBe(true)
        expect(mockSaveExampleSafely).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt: 'What is quantum computing?',
            response: 'This is a test AI response',
            model: 'gpt-4o-mini',
            status: 'completed',
            metadata: expect.objectContaining({
              tokens: 30,
              cost: 0.0001,
              provider: 'openai',
              isLocal: false
            })
          }),
          'user-123'
        )
      })

      test('should save example with correct metadata', async () => {
        mockExtractTokens.mockReturnValueOnce({ input: 50, output: 100, total: 150 })
        mockCalculateCost.mockReturnValueOnce(0.0025)

        const request = new NextRequest('http://localhost/api/plugin/ai/generate', {
          method: 'POST',
          body: JSON.stringify({
            prompt: 'Explain AI',
            model: 'gpt-4',
            saveExample: true
          })
        })

        await POST(request)

        expect(mockSaveExampleSafely).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              tokens: 150,
              cost: 0.0025,
              provider: 'openai',
              isLocal: false
            })
          }),
          'user-123'
        )
      })

      test('should continue even if example save fails', async () => {
        // saveExampleSafely handles errors internally and doesn't throw
        // So we just verify it's called and endpoint continues
        mockSaveExampleSafely.mockResolvedValueOnce(undefined)

        const request = new NextRequest('http://localhost/api/plugin/ai/generate', {
          method: 'POST',
          body: JSON.stringify({
            prompt: 'Test',
            saveExample: true
          })
        })

        const response = await POST(request)
        const data = await response.json()

        // Should still return successful response
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.response).toBeDefined()
        expect(mockSaveExampleSafely).toHaveBeenCalled()
      })

      test('should save example for local models', async () => {
        mockSelectModel.mockResolvedValueOnce({
          model: {} as any,
          modelName: 'llama3.2',
          provider: 'ollama',
          isLocal: true,
          costConfig: { input: 0, output: 0 }
        })

        const request = new NextRequest('http://localhost/api/plugin/ai/generate', {
          method: 'POST',
          body: JSON.stringify({
            prompt: 'Test',
            model: 'llama3.2',
            saveExample: true
          })
        })

        await POST(request)

        expect(mockSaveExampleSafely).toHaveBeenCalledWith(
          expect.objectContaining({
            model: 'llama3.2',
            metadata: expect.objectContaining({
              provider: 'ollama',
              isLocal: true
            })
          }),
          'user-123'
        )
      })
    })

    describe('Response Format', () => {
      test('should return complete response with all fields', async () => {
        const request = new NextRequest('http://localhost/api/plugin/ai/generate', {
          method: 'POST',
          body: JSON.stringify({ prompt: 'Test' })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(data).toEqual({
          success: true,
          response: expect.any(String),
          model: expect.any(String),
          provider: expect.any(String),
          isLocal: expect.any(Boolean),
          cost: expect.any(Number),
          tokens: expect.objectContaining({
            input: expect.any(Number),
            output: expect.any(Number),
            total: expect.any(Number)
          }),
          userId: expect.any(String),
          exampleSaved: expect.any(Boolean)
        })
      })
    })
  })

  describe('GET /api/plugin/ai/generate', () => {
    test('should return endpoint information', async () => {
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.endpoint).toBe('/api/plugin/ai/generate')
      expect(data.description).toBeDefined()
      expect(data.usage).toBeDefined()
      expect(data.example).toBeDefined()
      expect(data.models).toBeDefined()
      expect(data.setup).toBeDefined()
    })

    test('should include saveExample documentation', async () => {
      const response = await GET()
      const data = await response.json()

      expect(data.usage.body.saveExample).toBeDefined()
      expect(data.usage.body.saveExample).toContain('opt-in')
      expect(data.usage.body.saveExample).toContain('sanitized')
    })
  })
})