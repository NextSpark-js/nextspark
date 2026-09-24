/**
 * Unit Tests - Token Tracker Service
 *
 * Tests token usage tracking and cost calculation:
 * - Cost calculation for different models
 * - Usage tracking with database mocking
 * - Usage statistics retrieval
 * - Daily usage aggregation
 *
 * Focus: Business logic with mocked database calls.
 */

import { tokenTracker } from '@/plugins/langchain/lib/token-tracker'

// Mock database functions
jest.mock('@nextsparkjs/core/lib/db', () => ({
  mutateWithRLS: jest.fn(),
  queryWithRLS: jest.fn(),
}))

import { mutateWithRLS, queryWithRLS } from '@nextsparkjs/core/lib/db'

const mockMutate = mutateWithRLS as jest.MockedFunction<typeof mutateWithRLS>
const mockQuery = queryWithRLS as jest.MockedFunction<typeof queryWithRLS>

describe('Token Tracker Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('calculateCost', () => {
    describe('known models', () => {
      it('should calculate cost for gpt-4o', () => {
        const usage = { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 }
        const result = tokenTracker.calculateCost('gpt-4o', usage)

        // gpt-4o: input $5/1M, output $15/1M
        expect(result.inputCost).toBeCloseTo(0.005, 6) // 1000/1M * 5
        expect(result.outputCost).toBeCloseTo(0.0075, 6) // 500/1M * 15
        expect(result.totalCost).toBeCloseTo(0.0125, 6)
      })

      it('should calculate cost for gpt-4o-mini', () => {
        const usage = { inputTokens: 10000, outputTokens: 5000, totalTokens: 15000 }
        const result = tokenTracker.calculateCost('gpt-4o-mini', usage)

        // gpt-4o-mini: input $0.15/1M, output $0.60/1M
        expect(result.inputCost).toBeCloseTo(0.0015, 6) // 10000/1M * 0.15
        expect(result.outputCost).toBeCloseTo(0.003, 6) // 5000/1M * 0.60
        expect(result.totalCost).toBeCloseTo(0.0045, 6)
      })

      it('should calculate cost for gpt-4-turbo', () => {
        const usage = { inputTokens: 1000, outputTokens: 1000, totalTokens: 2000 }
        const result = tokenTracker.calculateCost('gpt-4-turbo', usage)

        // gpt-4-turbo: input $10/1M, output $30/1M
        expect(result.inputCost).toBeCloseTo(0.01, 6)
        expect(result.outputCost).toBeCloseTo(0.03, 6)
        expect(result.totalCost).toBeCloseTo(0.04, 6)
      })

      it('should calculate cost for gpt-3.5-turbo', () => {
        const usage = { inputTokens: 1000000, outputTokens: 500000, totalTokens: 1500000 }
        const result = tokenTracker.calculateCost('gpt-3.5-turbo', usage)

        // gpt-3.5-turbo: input $0.50/1M, output $1.50/1M
        expect(result.inputCost).toBeCloseTo(0.5, 6)
        expect(result.outputCost).toBeCloseTo(0.75, 6)
        expect(result.totalCost).toBeCloseTo(1.25, 6)
      })

      it('should calculate cost for claude-3-5-sonnet', () => {
        const usage = { inputTokens: 1000, outputTokens: 1000, totalTokens: 2000 }
        const result = tokenTracker.calculateCost('claude-3-5-sonnet', usage)

        // claude-3-5-sonnet: input $3/1M, output $15/1M
        expect(result.inputCost).toBeCloseTo(0.003, 6)
        expect(result.outputCost).toBeCloseTo(0.015, 6)
        expect(result.totalCost).toBeCloseTo(0.018, 6)
      })

      it('should calculate cost for claude-3-opus', () => {
        const usage = { inputTokens: 1000, outputTokens: 1000, totalTokens: 2000 }
        const result = tokenTracker.calculateCost('claude-3-opus', usage)

        // claude-3-opus: input $15/1M, output $75/1M
        expect(result.inputCost).toBeCloseTo(0.015, 6)
        expect(result.outputCost).toBeCloseTo(0.075, 6)
        expect(result.totalCost).toBeCloseTo(0.09, 6)
      })

      it('should calculate cost for claude-3-haiku', () => {
        const usage = { inputTokens: 10000, outputTokens: 10000, totalTokens: 20000 }
        const result = tokenTracker.calculateCost('claude-3-haiku', usage)

        // claude-3-haiku: input $0.25/1M, output $1.25/1M
        expect(result.inputCost).toBeCloseTo(0.0025, 6)
        expect(result.outputCost).toBeCloseTo(0.0125, 6)
        expect(result.totalCost).toBeCloseTo(0.015, 6)
      })
    })

    describe('ollama models (free)', () => {
      it('should return zero cost for ollama models', () => {
        const usage = { inputTokens: 100000, outputTokens: 50000, totalTokens: 150000 }
        const result = tokenTracker.calculateCost('ollama/llama3.2:3b', usage)

        expect(result.inputCost).toBe(0)
        expect(result.outputCost).toBe(0)
        expect(result.totalCost).toBe(0)
      })

      it('should match ollama wildcard pattern', () => {
        const models = ['ollama/mistral', 'ollama/codellama', 'ollama/phi3']
        const usage = { inputTokens: 1000, outputTokens: 1000, totalTokens: 2000 }

        models.forEach(model => {
          const result = tokenTracker.calculateCost(model, usage)
          expect(result.totalCost).toBe(0)
        })
      })
    })

    describe('unknown models', () => {
      it('should return zero cost for unknown models', () => {
        const usage = { inputTokens: 1000, outputTokens: 1000, totalTokens: 2000 }
        const result = tokenTracker.calculateCost('unknown-model', usage)

        expect(result.inputCost).toBe(0)
        expect(result.outputCost).toBe(0)
        expect(result.totalCost).toBe(0)
      })
    })

    describe('edge cases', () => {
      it('should handle zero tokens', () => {
        const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
        const result = tokenTracker.calculateCost('gpt-4o', usage)

        expect(result.inputCost).toBe(0)
        expect(result.outputCost).toBe(0)
        expect(result.totalCost).toBe(0)
      })

      it('should handle very large token counts', () => {
        const usage = { inputTokens: 10000000, outputTokens: 5000000, totalTokens: 15000000 }
        const result = tokenTracker.calculateCost('gpt-4o', usage)

        // gpt-4o: input $5/1M, output $15/1M
        expect(result.inputCost).toBeCloseTo(50, 2) // 10M/1M * 5
        expect(result.outputCost).toBeCloseTo(75, 2) // 5M/1M * 15
        expect(result.totalCost).toBeCloseTo(125, 2)
      })

      it('should use custom pricing when provided', () => {
        const usage = { inputTokens: 1000000, outputTokens: 1000000, totalTokens: 2000000 }
        const customPricing = {
          'custom-model': { input: 1.0, output: 2.0 },
        }

        const result = tokenTracker.calculateCost('custom-model', usage, customPricing)

        expect(result.inputCost).toBeCloseTo(1.0, 6)
        expect(result.outputCost).toBeCloseTo(2.0, 6)
        expect(result.totalCost).toBeCloseTo(3.0, 6)
      })
    })
  })

  describe('trackUsage', () => {
    const context = { userId: 'user-123', teamId: 'team-456' }

    it('should call mutateWithRLS with correct parameters', async () => {
      mockMutate.mockResolvedValue(undefined)

      await tokenTracker.trackUsage({
        context,
        sessionId: 'session-789',
        provider: 'openai',
        model: 'gpt-4o',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        agentName: 'test-agent',
      })

      expect(mockMutate).toHaveBeenCalledTimes(1)
      expect(mockMutate).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO'),
        expect.arrayContaining(['user-123', 'team-456', 'session-789', 'openai', 'gpt-4o']),
        'user-123'
      )
    })

    it('should pass null for optional sessionId', async () => {
      mockMutate.mockResolvedValue(undefined)

      await tokenTracker.trackUsage({
        context,
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      })

      expect(mockMutate).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([null]), // sessionId is null
        'user-123'
      )
    })

    it('should handle metadata serialization', async () => {
      mockMutate.mockResolvedValue(undefined)

      await tokenTracker.trackUsage({
        context,
        provider: 'openai',
        model: 'gpt-4o',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        metadata: { toolsUsed: ['search', 'calculator'], executionTime: 1500 },
      })

      expect(mockMutate).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.stringContaining('toolsUsed'),
        ]),
        'user-123'
      )
    })
  })

  describe('getUsage', () => {
    const context = { userId: 'user-123', teamId: 'team-456' }

    it('should return empty stats when no data exists', async () => {
      mockQuery.mockResolvedValue([])

      const result = await tokenTracker.getUsage(context, '30d')

      expect(result.totalTokens).toBe(0)
      expect(result.totalCost).toBe(0)
      expect(result.inputTokens).toBe(0)
      expect(result.outputTokens).toBe(0)
      expect(result.requestCount).toBe(0)
      expect(result.byModel).toEqual({})
    })

    it('should aggregate usage by model', async () => {
      mockQuery.mockResolvedValue([
        {
          model: 'gpt-4o',
          totalTokens: '1000',
          totalCost: '0.05',
          inputTokens: '600',
          outputTokens: '400',
          requestCount: '5',
          modelTokens: '1000',
          modelCost: '0.05',
        },
        {
          model: 'claude-3-5-sonnet',
          totalTokens: '2000',
          totalCost: '0.03',
          inputTokens: '1200',
          outputTokens: '800',
          requestCount: '10',
          modelTokens: '2000',
          modelCost: '0.03',
        },
      ])

      const result = await tokenTracker.getUsage(context, '30d')

      expect(result.totalTokens).toBe(3000)
      expect(result.totalCost).toBeCloseTo(0.08, 2)
      expect(result.requestCount).toBe(15)
      expect(result.byModel['gpt-4o'].tokens).toBe(1000)
      expect(result.byModel['claude-3-5-sonnet'].tokens).toBe(2000)
    })

    it('should apply correct period filter', async () => {
      mockQuery.mockResolvedValue([])

      await tokenTracker.getUsage(context, 'today')

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('CURRENT_DATE'),
        expect.any(Array),
        'user-123'
      )
    })

    it('should apply 7d period filter', async () => {
      mockQuery.mockResolvedValue([])

      await tokenTracker.getUsage(context, '7d')

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("7 days"),
        expect.any(Array),
        'user-123'
      )
    })

    it('should not apply filter for "all" period', async () => {
      mockQuery.mockResolvedValue([])

      await tokenTracker.getUsage(context, 'all')

      // Should not contain any date filter
      const query = mockQuery.mock.calls[0][0] as string
      expect(query).not.toContain('CURRENT_DATE')
      expect(query).not.toContain('interval')
    })
  })

  describe('getDailyUsage', () => {
    const context = { userId: 'user-123', teamId: 'team-456' }

    it('should return daily aggregated usage', async () => {
      mockQuery.mockResolvedValue([
        { date: '2024-01-15', tokens: '1000', cost: '0.05', requests: '10' },
        { date: '2024-01-14', tokens: '800', cost: '0.04', requests: '8' },
        { date: '2024-01-13', tokens: '1200', cost: '0.06', requests: '12' },
      ])

      const result = await tokenTracker.getDailyUsage(context, 7)

      expect(result).toHaveLength(3)
      expect(result[0].date).toBe('2024-01-15')
      expect(result[0].tokens).toBe(1000)
      expect(result[0].cost).toBeCloseTo(0.05, 2)
      expect(result[0].requests).toBe(10)
    })

    it('should return empty array when no data', async () => {
      mockQuery.mockResolvedValue([])

      const result = await tokenTracker.getDailyUsage(context, 30)

      expect(result).toEqual([])
    })

    it('should use parameterized query for days', async () => {
      mockQuery.mockResolvedValue([])

      await tokenTracker.getDailyUsage(context, 14)

      // Verify the days parameter is passed safely
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('$3'),
        expect.arrayContaining(['14']),
        'user-123'
      )
    })

    it('should validate days parameter bounds', async () => {
      mockQuery.mockResolvedValue([])

      // Should clamp negative values to 1
      await tokenTracker.getDailyUsage(context, -5)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['1']),
        'user-123'
      )
    })

    it('should cap days at 365', async () => {
      mockQuery.mockResolvedValue([])

      await tokenTracker.getDailyUsage(context, 1000)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['365']),
        'user-123'
      )
    })
  })

  describe('getTeamUsage', () => {
    it('should aggregate usage by user', async () => {
      mockQuery.mockResolvedValue([
        {
          userId: 'user-1',
          totalTokens: '5000',
          totalCost: '0.25',
          inputTokens: '3000',
          outputTokens: '2000',
          requestCount: '50',
        },
        {
          userId: 'user-2',
          totalTokens: '3000',
          totalCost: '0.15',
          inputTokens: '1800',
          outputTokens: '1200',
          requestCount: '30',
        },
      ])

      const result = await tokenTracker.getTeamUsage('team-456', '30d')

      expect(result.totalTokens).toBe(8000)
      expect(result.totalCost).toBeCloseTo(0.4, 2)
      expect(result.requestCount).toBe(80)
      expect(result.byUser['user-1'].tokens).toBe(5000)
      expect(result.byUser['user-2'].tokens).toBe(3000)
      expect(result.byModel).toEqual({}) // Not grouped by model for team view
    })

    it('should return empty stats when no team data', async () => {
      mockQuery.mockResolvedValue([])

      const result = await tokenTracker.getTeamUsage('team-456', '30d')

      expect(result.totalTokens).toBe(0)
      expect(result.byUser).toEqual({})
    })

    it('should use admin context for RLS', async () => {
      mockQuery.mockResolvedValue([])

      await tokenTracker.getTeamUsage('team-456', '7d')

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['team-456']),
        'admin' // Uses admin context
      )
    })
  })

  describe('getPeriodClause', () => {
    it('should return correct clause for today', () => {
      const clause = tokenTracker.getPeriodClause('today')
      expect(clause).toContain('CURRENT_DATE')
    })

    it('should return correct clause for 7d', () => {
      const clause = tokenTracker.getPeriodClause('7d')
      expect(clause).toContain('7 days')
    })

    it('should return correct clause for 30d', () => {
      const clause = tokenTracker.getPeriodClause('30d')
      expect(clause).toContain('30 days')
    })

    it('should return empty string for all', () => {
      const clause = tokenTracker.getPeriodClause('all')
      expect(clause).toBe('')
    })
  })
})
