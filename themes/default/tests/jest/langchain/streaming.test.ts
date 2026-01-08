/**
 * Unit Tests - Streaming Service
 *
 * Tests token-by-token streaming functionality:
 * - SSE encoder creation and encoding
 * - Stream chunk types
 * - StreamChat generator behavior with mocks
 *
 * Focus: Utility functions and mocked streaming behavior.
 */

// Mock @langchain/core/messages before importing anything
jest.mock('@langchain/core/messages', () => ({
  BaseMessage: class {},
  HumanMessage: class {
    constructor(public content: string) {}
  },
  AIMessage: class {
    constructor(public content: string) {}
  },
}))

// Mock dependencies
jest.mock('@/contents/plugins/langchain/lib/db-memory-store', () => ({
  dbMemoryStore: {
    getMessages: jest.fn().mockResolvedValue([]),
    addMessages: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('@/contents/plugins/langchain/lib/token-tracker', () => ({
  tokenTracker: {
    trackUsage: jest.fn().mockResolvedValue(undefined),
  },
}))

import { createSSEEncoder } from '@/plugins/langchain/lib/streaming'
import type { StreamChunk } from '@/plugins/langchain/lib/streaming'

describe('Streaming Service', () => {
  describe('createSSEEncoder', () => {
    let encoder: ReturnType<typeof createSSEEncoder>

    beforeEach(() => {
      encoder = createSSEEncoder()
    })

    describe('encode', () => {
      it('should encode token chunk correctly', () => {
        const chunk: StreamChunk = { type: 'token', content: 'Hello' }
        const result = encoder.encode(chunk)

        const decoded = new TextDecoder().decode(result)
        expect(decoded).toBe('data: {"type":"token","content":"Hello"}\n\n')
      })

      it('should encode done chunk with full content', () => {
        const chunk: StreamChunk = {
          type: 'done',
          fullContent: 'Complete message',
          agentUsed: 'test-agent',
          tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        }
        const result = encoder.encode(chunk)

        const decoded = new TextDecoder().decode(result)
        expect(decoded).toContain('"type":"done"')
        expect(decoded).toContain('"fullContent":"Complete message"')
        expect(decoded).toContain('"agentUsed":"test-agent"')
        expect(decoded).toContain('"tokenUsage"')
      })

      it('should encode error chunk', () => {
        const chunk: StreamChunk = { type: 'error', error: 'Something went wrong' }
        const result = encoder.encode(chunk)

        const decoded = new TextDecoder().decode(result)
        expect(decoded).toBe('data: {"type":"error","error":"Something went wrong"}\n\n')
      })

      it('should encode tool_start chunk', () => {
        const chunk: StreamChunk = { type: 'tool_start', toolName: 'search' }
        const result = encoder.encode(chunk)

        const decoded = new TextDecoder().decode(result)
        expect(decoded).toContain('"type":"tool_start"')
        expect(decoded).toContain('"toolName":"search"')
      })

      it('should encode tool_end chunk with result', () => {
        const chunk: StreamChunk = {
          type: 'tool_end',
          toolName: 'calculator',
          result: { value: 42 },
        }
        const result = encoder.encode(chunk)

        const decoded = new TextDecoder().decode(result)
        expect(decoded).toContain('"type":"tool_end"')
        expect(decoded).toContain('"toolName":"calculator"')
        expect(decoded).toContain('"result":{"value":42}')
      })

      it('should handle special characters in content', () => {
        const chunk: StreamChunk = {
          type: 'token',
          content: 'Hello\nWorld\t"Special" chars: é ñ 中文',
        }
        const result = encoder.encode(chunk)

        const decoded = new TextDecoder().decode(result)
        expect(decoded).toContain('data: ')
        expect(decoded).toContain('\\n') // Escaped newline
        expect(decoded).toContain('\\t') // Escaped tab
        expect(decoded).toContain('\\"') // Escaped quote
      })

      it('should handle empty content', () => {
        const chunk: StreamChunk = { type: 'token', content: '' }
        const result = encoder.encode(chunk)

        const decoded = new TextDecoder().decode(result)
        expect(decoded).toBe('data: {"type":"token","content":""}\n\n')
      })

      it('should return Uint8Array', () => {
        const chunk: StreamChunk = { type: 'token', content: 'test' }
        const result = encoder.encode(chunk)

        // Use constructor name check to avoid jsdom cross-realm issues
        expect(result.constructor.name).toBe('Uint8Array')
      })
    })

    describe('encodeDone', () => {
      it('should encode done marker', () => {
        const result = encoder.encodeDone()

        const decoded = new TextDecoder().decode(result)
        expect(decoded).toBe('data: [DONE]\n\n')
      })

      it('should return Uint8Array', () => {
        const result = encoder.encodeDone()

        // Use constructor name check to avoid jsdom cross-realm issues
        expect(result.constructor.name).toBe('Uint8Array')
      })
    })
  })

  describe('StreamChunk types', () => {
    it('should support token chunk type', () => {
      const chunk: StreamChunk = { type: 'token', content: 'text' }
      expect(chunk.type).toBe('token')
      expect(chunk.content).toBe('text')
    })

    it('should support done chunk type with all fields', () => {
      const chunk: StreamChunk = {
        type: 'done',
        fullContent: 'Full response',
        agentUsed: 'assistant',
        tokenUsage: {
          inputTokens: 100,
          outputTokens: 200,
          totalTokens: 300,
        },
      }

      expect(chunk.type).toBe('done')
      expect(chunk.fullContent).toBe('Full response')
      expect(chunk.agentUsed).toBe('assistant')
      expect(chunk.tokenUsage?.totalTokens).toBe(300)
    })

    it('should support done chunk type with minimal fields', () => {
      const chunk: StreamChunk = {
        type: 'done',
        fullContent: 'Response',
      }

      expect(chunk.type).toBe('done')
      expect(chunk.fullContent).toBe('Response')
      expect(chunk.agentUsed).toBeUndefined()
      expect(chunk.tokenUsage).toBeUndefined()
    })

    it('should support error chunk type', () => {
      const chunk: StreamChunk = { type: 'error', error: 'Error message' }
      expect(chunk.type).toBe('error')
      expect(chunk.error).toBe('Error message')
    })

    it('should support tool_start chunk type', () => {
      const chunk: StreamChunk = { type: 'tool_start', toolName: 'search' }
      expect(chunk.type).toBe('tool_start')
      expect(chunk.toolName).toBe('search')
    })

    it('should support tool_end chunk type', () => {
      const chunk: StreamChunk = {
        type: 'tool_end',
        toolName: 'search',
        result: ['result1', 'result2'],
      }

      expect(chunk.type).toBe('tool_end')
      expect(chunk.toolName).toBe('search')
      expect(chunk.result).toEqual(['result1', 'result2'])
    })
  })

  describe('SSE format compliance', () => {
    it('should produce valid SSE format with data prefix', () => {
      const encoder = createSSEEncoder()
      const chunk: StreamChunk = { type: 'token', content: 'test' }
      const result = new TextDecoder().decode(encoder.encode(chunk))

      expect(result.startsWith('data: ')).toBe(true)
    })

    it('should end with double newline', () => {
      const encoder = createSSEEncoder()
      const chunk: StreamChunk = { type: 'token', content: 'test' }
      const result = new TextDecoder().decode(encoder.encode(chunk))

      expect(result.endsWith('\n\n')).toBe(true)
    })

    it('should produce valid JSON in data field', () => {
      const encoder = createSSEEncoder()
      const chunk: StreamChunk = { type: 'token', content: 'test' }
      const result = new TextDecoder().decode(encoder.encode(chunk))

      // Extract JSON from SSE format
      const jsonStr = result.slice(6, -2) // Remove 'data: ' prefix and '\n\n' suffix
      expect(() => JSON.parse(jsonStr)).not.toThrow()
    })

    it('should handle multiple chunks correctly', () => {
      const encoder = createSSEEncoder()
      const chunks: StreamChunk[] = [
        { type: 'token', content: 'Hello' },
        { type: 'token', content: ' ' },
        { type: 'token', content: 'World' },
        { type: 'done', fullContent: 'Hello World' },
      ]

      const results = chunks.map(chunk => new TextDecoder().decode(encoder.encode(chunk)))

      results.forEach(result => {
        expect(result.startsWith('data: ')).toBe(true)
        expect(result.endsWith('\n\n')).toBe(true)
      })
    })
  })

  describe('Edge cases', () => {
    it('should handle very long content', () => {
      const encoder = createSSEEncoder()
      const longContent = 'a'.repeat(100000)
      const chunk: StreamChunk = { type: 'token', content: longContent }

      const result = encoder.encode(chunk)
      const decoded = new TextDecoder().decode(result)

      expect(decoded).toContain(longContent)
      expect(decoded.startsWith('data: ')).toBe(true)
    })

    it('should handle unicode content', () => {
      const encoder = createSSEEncoder()
      const unicodeContent = '你好世界 🌍 مرحبا العالم'
      const chunk: StreamChunk = { type: 'token', content: unicodeContent }

      const result = encoder.encode(chunk)
      const decoded = new TextDecoder().decode(result)

      // Parse the JSON to verify unicode is preserved
      const jsonStr = decoded.slice(6, -2)
      const parsed = JSON.parse(jsonStr)
      expect(parsed.content).toBe(unicodeContent)
    })

    it('should handle newlines in content', () => {
      const encoder = createSSEEncoder()
      const chunk: StreamChunk = {
        type: 'token',
        content: 'Line 1\nLine 2\nLine 3',
      }

      const result = encoder.encode(chunk)
      const decoded = new TextDecoder().decode(result)

      // Newlines should be escaped in JSON
      expect(decoded).toContain('\\n')
      expect(decoded.split('\n').length).toBe(3) // data: {...}\n\n = 3 parts
    })

    it('should handle null result in tool_end', () => {
      const encoder = createSSEEncoder()
      const chunk: StreamChunk = {
        type: 'tool_end',
        toolName: 'void_tool',
        result: null,
      }

      const result = encoder.encode(chunk)
      const decoded = new TextDecoder().decode(result)

      expect(decoded).toContain('"result":null')
    })

    it('should handle complex nested result in tool_end', () => {
      const encoder = createSSEEncoder()
      const chunk: StreamChunk = {
        type: 'tool_end',
        toolName: 'complex_tool',
        result: {
          nested: {
            array: [1, 2, { deep: 'value' }],
            string: 'text',
          },
          number: 42,
        },
      }

      const result = encoder.encode(chunk)
      const decoded = new TextDecoder().decode(result)
      const jsonStr = decoded.slice(6, -2)
      const parsed = JSON.parse(jsonStr)

      expect(parsed.result.nested.array).toHaveLength(3)
      expect(parsed.result.nested.array[2].deep).toBe('value')
    })
  })

  describe('Performance characteristics', () => {
    it('should be efficient for single chunk encoding', () => {
      const encoder = createSSEEncoder()
      const chunk: StreamChunk = { type: 'token', content: 'test' }

      const start = performance.now()
      for (let i = 0; i < 1000; i++) {
        encoder.encode(chunk)
      }
      const duration = performance.now() - start

      // Should encode 1000 chunks in less than 100ms
      expect(duration).toBeLessThan(100)
    })

    it('should reuse encoder instance efficiently', () => {
      const encoder = createSSEEncoder()
      const chunks: StreamChunk[] = Array.from({ length: 100 }, (_, i) => ({
        type: 'token' as const,
        content: `Token ${i}`,
      }))

      const results = chunks.map(chunk => encoder.encode(chunk))

      expect(results).toHaveLength(100)
      results.forEach(result => {
        // Use constructor name check to avoid jsdom cross-realm issues
        expect(result.constructor.name).toBe('Uint8Array')
      })
    })
  })
})
