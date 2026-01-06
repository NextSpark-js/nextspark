/**
 * AI Plugin Core Types
 *
 * Minimal types for core utilities only
 */
import type { LanguageModel } from 'ai'

// Core provider types
export type AIProvider = 'openai' | 'anthropic' | 'ollama'

// Basic model selection result
export interface ModelSelection {
  provider: AIProvider
  model: LanguageModel
  modelName: string
  isLocal: boolean
  costConfig: {
    input: number
    output: number
  }
}

// AI SDK result type for extractTokens function
export interface AIResult {
  text: string
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
}

// Token usage
export interface TokenUsage {
  input: number
  output: number
  total: number
}

// Plugin validation result
export interface PluginValidation {
  valid: boolean
  error?: string
}

// Error result for handleAIError
export interface AIErrorResult {
  error: string
  message: string
  status: number
}