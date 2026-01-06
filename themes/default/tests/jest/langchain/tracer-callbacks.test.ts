/**
 * Unit Tests - Tracing Callback Handler
 *
 * Tests LangChain callback handler integration:
 * - LLM event handling (start, end, error)
 * - Tool event handling (start, end, error)
 * - Chain event handling (start, end, error)
 * - Parent-child span relationships
 * - Depth tracking
 *
 * Focus: Event transformation and span lifecycle.
 */

import {
  TracingCallbackHandler,
  createTracingCallbacks,
} from '@/plugins/langchain/lib/tracer-callbacks'
import { tracer } from '@/plugins/langchain/lib/tracer'
import type { Serialized } from '@langchain/core/load/serializable'

// Mock tracer service
jest.mock('@/contents/plugins/langchain/lib/tracer', () => ({
  tracer: {
    startSpan: jest.fn(),
    endSpan: jest.fn(),
  },
}))

const mockStartSpan = tracer.startSpan as jest.MockedFunction<typeof tracer.startSpan>
const mockEndSpan = tracer.endSpan as jest.MockedFunction<typeof tracer.endSpan>

describe('TracingCallbackHandler', () => {
  const context = { userId: 'user-123', teamId: 'team-456' }
  const traceId = 'trace-abc'
  let handler: TracingCallbackHandler

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new TracingCallbackHandler({ context, traceId })
  })

  describe('initialization', () => {
    it('should initialize with correct name', () => {
      expect(handler.name).toBe('tracing_callback_handler')
    })

    it('should store context and traceId', () => {
      // Context and traceId are private, so we test indirectly via method calls
      mockStartSpan.mockResolvedValue({
        spanId: 'span-123',
        traceId,
        name: 'test',
        type: 'llm',
        depth: 0,
        startedAt: new Date(),
      })

      handler.handleLLMStart(
        { id: ['langchain', 'llms', 'openai'] } as Serialized,
        ['test prompt'],
        'run-123'
      )

      expect(mockStartSpan).toHaveBeenCalledWith(
        context,
        traceId,
        expect.any(Object)
      )
    })
  })

  describe('handleLLMStart', () => {
    it('should create span for LLM call', async () => {
      const llm: Serialized = {
        id: ['langchain', 'llms', 'openai'],
        kwargs: { model: 'gpt-4o' },
      }
      mockStartSpan.mockResolvedValue({
        spanId: 'span-123',
        traceId,
        name: 'LLM: gpt-4o',
        type: 'llm',
        depth: 0,
        startedAt: new Date(),
      })

      await handler.handleLLMStart(llm, ['test prompt'], 'run-123')

      expect(mockStartSpan).toHaveBeenCalledWith(context, traceId, {
        name: 'LLM: gpt-4o',
        type: 'llm',
        provider: 'openai',
        model: 'gpt-4o',
        parentSpanId: undefined,
        depth: 0,
        input: { prompts: ['test prompt'] },
      })
    })

    it('should extract provider from LLM serialized id', async () => {
      const llm: Serialized = {
        id: ['langchain', 'chat_models', 'anthropic'],
        kwargs: { model: 'claude-3-5-sonnet' },
      }
      mockStartSpan.mockResolvedValue(null)

      await handler.handleLLMStart(llm, ['test'], 'run-123')

      expect(mockStartSpan).toHaveBeenCalledWith(
        context,
        traceId,
        expect.objectContaining({
          provider: 'anthropic',
        })
      )
    })

    it('should use "unknown" for missing model', async () => {
      const llm: Serialized = {
        id: ['langchain', 'llms', 'custom'],
      }
      mockStartSpan.mockResolvedValue(null)

      await handler.handleLLMStart(llm, ['test'], 'run-123')

      expect(mockStartSpan).toHaveBeenCalledWith(
        context,
        traceId,
        expect.objectContaining({
          model: 'unknown',
        })
      )
    })

    it('should handle nested LLM calls with depth', async () => {
      const llm: Serialized = {
        id: ['langchain', 'llms', 'openai'],
        kwargs: { model: 'gpt-4o' },
      }

      // First, create a parent span from a different parent to set up parentSpans map
      mockStartSpan.mockResolvedValueOnce({
        spanId: 'span-grandparent',
        traceId,
        name: 'LLM: gpt-4o',
        type: 'llm',
        depth: 0,
        startedAt: new Date(),
      })
      await handler.handleLLMStart(llm, ['prompt 0'], 'run-grandparent')

      // Second call with grandparent as parent (depth 1)
      mockStartSpan.mockResolvedValueOnce({
        spanId: 'span-parent',
        traceId,
        name: 'LLM: gpt-4o',
        type: 'llm',
        depth: 1,
        startedAt: new Date(),
      })
      await handler.handleLLMStart(llm, ['prompt 1'], 'run-parent', 'run-grandparent')

      // Third call nested under parent (depth 2)
      mockStartSpan.mockResolvedValueOnce({
        spanId: 'span-child',
        traceId,
        name: 'LLM: gpt-4o',
        type: 'llm',
        depth: 2,
        startedAt: new Date(),
      })
      await handler.handleLLMStart(llm, ['prompt 2'], 'run-child', 'run-parent')

      expect(mockStartSpan).toHaveBeenLastCalledWith(
        context,
        traceId,
        expect.objectContaining({
          depth: 2,
          parentSpanId: 'span-parent',
        })
      )
    })

    it('should handle errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockStartSpan.mockRejectedValue(new Error('Database error'))

      await handler.handleLLMStart(
        { id: ['langchain', 'llms', 'openai'] } as Serialized,
        ['test'],
        'run-123'
      )

      expect(consoleSpy).toHaveBeenCalledWith(
        '[TracingCallbackHandler] handleLLMStart error:',
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })
  })

  describe('handleLLMEnd', () => {
    beforeEach(async () => {
      // Setup: Start an LLM span first
      mockStartSpan.mockResolvedValue({
        spanId: 'span-123',
        traceId,
        name: 'LLM: gpt-4o',
        type: 'llm',
        depth: 0,
        startedAt: new Date(),
      })
      await handler.handleLLMStart(
        { id: ['langchain', 'llms', 'openai'], kwargs: { model: 'gpt-4o' } } as Serialized,
        ['test prompt'],
        'run-123'
      )
      jest.clearAllMocks()
    })

    it('should end span with output and token usage', async () => {
      mockEndSpan.mockResolvedValue(undefined)

      await handler.handleLLMEnd(
        {
          generations: [{ text: 'Generated response' }],
          llmOutput: {
            tokenUsage: {
              promptTokens: 100,
              completionTokens: 50,
            },
          },
        },
        'run-123'
      )

      expect(mockEndSpan).toHaveBeenCalledWith(context, traceId, 'span-123', {
        output: {
          generations: ['Generated response'],
        },
        tokens: {
          input: 100,
          output: 50,
        },
      })
    })

    it('should handle alternate token usage format (input_tokens/output_tokens)', async () => {
      mockEndSpan.mockResolvedValue(undefined)

      await handler.handleLLMEnd(
        {
          generations: [{ text: 'response' }],
          llmOutput: {
            tokenUsage: {
              input_tokens: 200,
              output_tokens: 75,
            },
          },
        },
        'run-123'
      )

      expect(mockEndSpan).toHaveBeenCalledWith(
        context,
        traceId,
        'span-123',
        expect.objectContaining({
          tokens: {
            input: 200,
            output: 75,
          },
        })
      )
    })

    it('should handle message format generations', async () => {
      mockEndSpan.mockResolvedValue(undefined)

      await handler.handleLLMEnd(
        {
          generations: [{ message: { content: 'Message response' } }],
          llmOutput: { tokenUsage: {} },
        },
        'run-123'
      )

      expect(mockEndSpan).toHaveBeenCalledWith(
        context,
        traceId,
        'span-123',
        expect.objectContaining({
          output: {
            generations: ['Message response'],
          },
        })
      )
    })

    it('should handle missing token usage', async () => {
      mockEndSpan.mockResolvedValue(undefined)

      await handler.handleLLMEnd(
        {
          generations: [{ text: 'response' }],
          llmOutput: {},
        },
        'run-123'
      )

      expect(mockEndSpan).toHaveBeenCalledWith(
        context,
        traceId,
        'span-123',
        expect.objectContaining({
          tokens: undefined,
        })
      )
    })

    it('should do nothing if span was not started', async () => {
      await handler.handleLLMEnd({ generations: [] }, 'unknown-run-id')

      expect(mockEndSpan).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockEndSpan.mockRejectedValue(new Error('Database error'))

      await handler.handleLLMEnd({ generations: [] }, 'run-123')

      expect(consoleSpy).toHaveBeenCalledWith(
        '[TracingCallbackHandler] handleLLMEnd error:',
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })
  })

  describe('handleLLMError', () => {
    beforeEach(async () => {
      // Setup: Start an LLM span first
      mockStartSpan.mockResolvedValue({
        spanId: 'span-123',
        traceId,
        name: 'LLM: gpt-4o',
        type: 'llm',
        depth: 0,
        startedAt: new Date(),
      })
      await handler.handleLLMStart(
        { id: ['langchain', 'llms', 'openai'] } as Serialized,
        ['test'],
        'run-123'
      )
      jest.clearAllMocks()
    })

    it('should end span with error', async () => {
      mockEndSpan.mockResolvedValue(undefined)
      const error = new Error('LLM execution failed')

      await handler.handleLLMError(error, 'run-123')

      expect(mockEndSpan).toHaveBeenCalledWith(context, traceId, 'span-123', {
        error,
      })
    })

    it('should do nothing if span was not started', async () => {
      await handler.handleLLMError(new Error('test'), 'unknown-run-id')

      expect(mockEndSpan).not.toHaveBeenCalled()
    })

    it('should handle errors in error handling', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockEndSpan.mockRejectedValue(new Error('Database error'))

      await handler.handleLLMError(new Error('LLM error'), 'run-123')

      expect(consoleSpy).toHaveBeenCalledWith(
        '[TracingCallbackHandler] handleLLMError error:',
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })
  })

  describe('handleToolStart', () => {
    it('should create span for tool call', async () => {
      const tool: Serialized = {
        id: ['langchain', 'tools', 'search'],
      }
      mockStartSpan.mockResolvedValue({
        spanId: 'span-123',
        traceId,
        name: 'Tool: search',
        type: 'tool',
        depth: 0,
        startedAt: new Date(),
      })

      await handler.handleToolStart(tool, 'query term', 'run-123')

      expect(mockStartSpan).toHaveBeenCalledWith(context, traceId, {
        name: 'Tool: search',
        type: 'tool',
        toolName: 'search',
        parentSpanId: undefined,
        depth: 0,
        input: { toolInput: 'query term' },
      })
    })

    it('should extract tool name from serialized id', async () => {
      const tool: Serialized = {
        id: ['langchain', 'tools', 'calculator'],
      }
      mockStartSpan.mockResolvedValue(null)

      await handler.handleToolStart(tool, '2 + 2', 'run-123')

      expect(mockStartSpan).toHaveBeenCalledWith(
        context,
        traceId,
        expect.objectContaining({
          toolName: 'calculator',
        })
      )
    })

    it('should use "unknown" for missing tool name', async () => {
      const tool: Serialized = { id: [] }
      mockStartSpan.mockResolvedValue(null)

      await handler.handleToolStart(tool, 'input', 'run-123')

      expect(mockStartSpan).toHaveBeenCalledWith(
        context,
        traceId,
        expect.objectContaining({
          toolName: 'unknown',
        })
      )
    })

    it('should handle nested tool calls with depth', async () => {
      // Grandparent span
      mockStartSpan.mockResolvedValueOnce({
        spanId: 'span-grandparent',
        traceId,
        name: 'Tool: search',
        type: 'tool',
        depth: 0,
        startedAt: new Date(),
      })
      await handler.handleToolStart(
        { id: ['langchain', 'tools', 'search'] } as Serialized,
        'query1',
        'run-grandparent'
      )

      // Parent span
      mockStartSpan.mockResolvedValueOnce({
        spanId: 'span-parent',
        traceId,
        name: 'Tool: search',
        type: 'tool',
        depth: 1,
        startedAt: new Date(),
      })
      await handler.handleToolStart(
        { id: ['langchain', 'tools', 'search'] } as Serialized,
        'query',
        'run-parent',
        'run-grandparent'
      )

      // Child span
      mockStartSpan.mockResolvedValueOnce({
        spanId: 'span-child',
        traceId,
        name: 'Tool: calculator',
        type: 'tool',
        depth: 2,
        startedAt: new Date(),
      })
      await handler.handleToolStart(
        { id: ['langchain', 'tools', 'calculator'] } as Serialized,
        '2 + 2',
        'run-child',
        'run-parent'
      )

      expect(mockStartSpan).toHaveBeenLastCalledWith(
        context,
        traceId,
        expect.objectContaining({
          depth: 2,
          parentSpanId: 'span-parent',
        })
      )
    })

    it('should handle errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockStartSpan.mockRejectedValue(new Error('Database error'))

      await handler.handleToolStart(
        { id: ['langchain', 'tools', 'search'] } as Serialized,
        'query',
        'run-123'
      )

      expect(consoleSpy).toHaveBeenCalledWith(
        '[TracingCallbackHandler] handleToolStart error:',
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })
  })

  describe('handleToolEnd', () => {
    beforeEach(async () => {
      // Setup: Start a tool span first
      mockStartSpan.mockResolvedValue({
        spanId: 'span-123',
        traceId,
        name: 'Tool: search',
        type: 'tool',
        depth: 0,
        startedAt: new Date(),
      })
      await handler.handleToolStart(
        { id: ['langchain', 'tools', 'search'] } as Serialized,
        'query',
        'run-123'
      )
      jest.clearAllMocks()
    })

    it('should end span with tool output', async () => {
      mockEndSpan.mockResolvedValue(undefined)

      await handler.handleToolEnd('Search results: item1, item2', 'run-123')

      expect(mockEndSpan).toHaveBeenCalledWith(context, traceId, 'span-123', {
        toolOutput: 'Search results: item1, item2',
      })
    })

    it('should do nothing if span was not started', async () => {
      await handler.handleToolEnd('output', 'unknown-run-id')

      expect(mockEndSpan).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockEndSpan.mockRejectedValue(new Error('Database error'))

      await handler.handleToolEnd('output', 'run-123')

      expect(consoleSpy).toHaveBeenCalledWith(
        '[TracingCallbackHandler] handleToolEnd error:',
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })
  })

  describe('handleToolError', () => {
    beforeEach(async () => {
      // Setup: Start a tool span first
      mockStartSpan.mockResolvedValue({
        spanId: 'span-123',
        traceId,
        name: 'Tool: search',
        type: 'tool',
        depth: 0,
        startedAt: new Date(),
      })
      await handler.handleToolStart(
        { id: ['langchain', 'tools', 'search'] } as Serialized,
        'query',
        'run-123'
      )
      jest.clearAllMocks()
    })

    it('should end span with error', async () => {
      mockEndSpan.mockResolvedValue(undefined)
      const error = new Error('Tool execution failed')

      await handler.handleToolError(error, 'run-123')

      expect(mockEndSpan).toHaveBeenCalledWith(context, traceId, 'span-123', {
        error,
      })
    })

    it('should do nothing if span was not started', async () => {
      await handler.handleToolError(new Error('test'), 'unknown-run-id')

      expect(mockEndSpan).not.toHaveBeenCalled()
    })

    it('should handle errors in error handling', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockEndSpan.mockRejectedValue(new Error('Database error'))

      await handler.handleToolError(new Error('Tool error'), 'run-123')

      expect(consoleSpy).toHaveBeenCalledWith(
        '[TracingCallbackHandler] handleToolError error:',
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })
  })

  describe('handleChainStart', () => {
    it('should create span for chain execution', async () => {
      const chain: Serialized = {
        id: ['langchain', 'chains', 'llm_chain'],
      }
      mockStartSpan.mockResolvedValue({
        spanId: 'span-123',
        traceId,
        name: 'Chain: llm_chain',
        type: 'chain',
        depth: 0,
        startedAt: new Date(),
      })

      await handler.handleChainStart(chain, { input: 'test' }, 'run-123')

      expect(mockStartSpan).toHaveBeenCalledWith(context, traceId, {
        name: 'Chain: llm_chain',
        type: 'chain',
        parentSpanId: undefined,
        depth: 0,
        input: { input: 'test' },
      })
    })

    it('should extract chain name from serialized id', async () => {
      const chain: Serialized = {
        id: ['langchain', 'chains', 'sequential_chain'],
      }
      mockStartSpan.mockResolvedValue(null)

      await handler.handleChainStart(chain, {}, 'run-123')

      expect(mockStartSpan).toHaveBeenCalledWith(
        context,
        traceId,
        expect.objectContaining({
          name: 'Chain: sequential_chain',
        })
      )
    })

    it('should use "unknown" for missing chain name', async () => {
      const chain: Serialized = { id: [] }
      mockStartSpan.mockResolvedValue(null)

      await handler.handleChainStart(chain, {}, 'run-123')

      expect(mockStartSpan).toHaveBeenCalledWith(
        context,
        traceId,
        expect.objectContaining({
          name: 'Chain: unknown',
        })
      )
    })

    it('should handle nested chains with depth', async () => {
      // Grandparent chain
      mockStartSpan.mockResolvedValueOnce({
        spanId: 'span-grandparent',
        traceId,
        name: 'Chain: root',
        type: 'chain',
        depth: 0,
        startedAt: new Date(),
      })
      await handler.handleChainStart(
        { id: ['langchain', 'chains', 'root'] } as Serialized,
        {},
        'run-grandparent'
      )

      // Parent chain
      mockStartSpan.mockResolvedValueOnce({
        spanId: 'span-parent',
        traceId,
        name: 'Chain: main',
        type: 'chain',
        depth: 1,
        startedAt: new Date(),
      })
      await handler.handleChainStart(
        { id: ['langchain', 'chains', 'main'] } as Serialized,
        {},
        'run-parent',
        'run-grandparent'
      )

      // Child chain
      mockStartSpan.mockResolvedValueOnce({
        spanId: 'span-child',
        traceId,
        name: 'Chain: sub',
        type: 'chain',
        depth: 2,
        startedAt: new Date(),
      })
      await handler.handleChainStart(
        { id: ['langchain', 'chains', 'sub'] } as Serialized,
        {},
        'run-child',
        'run-parent'
      )

      expect(mockStartSpan).toHaveBeenLastCalledWith(
        context,
        traceId,
        expect.objectContaining({
          depth: 2,
          parentSpanId: 'span-parent',
        })
      )
    })

    it('should handle errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockStartSpan.mockRejectedValue(new Error('Database error'))

      await handler.handleChainStart(
        { id: ['langchain', 'chains', 'test'] } as Serialized,
        {},
        'run-123'
      )

      expect(consoleSpy).toHaveBeenCalledWith(
        '[TracingCallbackHandler] handleChainStart error:',
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })
  })

  describe('handleChainEnd', () => {
    beforeEach(async () => {
      // Setup: Start a chain span first
      mockStartSpan.mockResolvedValue({
        spanId: 'span-123',
        traceId,
        name: 'Chain: test',
        type: 'chain',
        depth: 0,
        startedAt: new Date(),
      })
      await handler.handleChainStart(
        { id: ['langchain', 'chains', 'test'] } as Serialized,
        {},
        'run-123'
      )
      jest.clearAllMocks()
    })

    it('should end span with chain outputs', async () => {
      mockEndSpan.mockResolvedValue(undefined)

      await handler.handleChainEnd({ output: 'result', metadata: { duration: 100 } }, 'run-123')

      expect(mockEndSpan).toHaveBeenCalledWith(context, traceId, 'span-123', {
        output: { output: 'result', metadata: { duration: 100 } },
      })
    })

    it('should do nothing if span was not started', async () => {
      await handler.handleChainEnd({}, 'unknown-run-id')

      expect(mockEndSpan).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockEndSpan.mockRejectedValue(new Error('Database error'))

      await handler.handleChainEnd({}, 'run-123')

      expect(consoleSpy).toHaveBeenCalledWith(
        '[TracingCallbackHandler] handleChainEnd error:',
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })
  })

  describe('handleChainError', () => {
    beforeEach(async () => {
      // Setup: Start a chain span first
      mockStartSpan.mockResolvedValue({
        spanId: 'span-123',
        traceId,
        name: 'Chain: test',
        type: 'chain',
        depth: 0,
        startedAt: new Date(),
      })
      await handler.handleChainStart(
        { id: ['langchain', 'chains', 'test'] } as Serialized,
        {},
        'run-123'
      )
      jest.clearAllMocks()
    })

    it('should end span with error', async () => {
      mockEndSpan.mockResolvedValue(undefined)
      const error = new Error('Chain execution failed')

      await handler.handleChainError(error, 'run-123')

      expect(mockEndSpan).toHaveBeenCalledWith(context, traceId, 'span-123', {
        error,
      })
    })

    it('should do nothing if span was not started', async () => {
      await handler.handleChainError(new Error('test'), 'unknown-run-id')

      expect(mockEndSpan).not.toHaveBeenCalled()
    })

    it('should handle errors in error handling', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockEndSpan.mockRejectedValue(new Error('Database error'))

      await handler.handleChainError(new Error('Chain error'), 'run-123')

      expect(consoleSpy).toHaveBeenCalledWith(
        '[TracingCallbackHandler] handleChainError error:',
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })
  })

  describe('createTracingCallbacks factory', () => {
    it('should create TracingCallbackHandler instance', () => {
      const callbacks = createTracingCallbacks(context, traceId)

      expect(callbacks).toBeInstanceOf(TracingCallbackHandler)
      expect(callbacks.name).toBe('tracing_callback_handler')
    })

    it('should pass context and traceId to handler', async () => {
      const callbacks = createTracingCallbacks(context, 'trace-xyz')
      mockStartSpan.mockResolvedValue(null)

      await callbacks.handleLLMStart(
        { id: ['langchain', 'llms', 'openai'] } as Serialized,
        ['test'],
        'run-123'
      )

      expect(mockStartSpan).toHaveBeenCalledWith(
        context,
        'trace-xyz',
        expect.any(Object)
      )
    })
  })
})
