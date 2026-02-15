/**
 * Anthropic SDK Client
 *
 * Initializes and exports the Anthropic client for Claude API calls.
 */

import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null

/**
 * Get or create the Anthropic client instance.
 * Uses ANTHROPIC_API_KEY from environment.
 */
export function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY environment variable is required.\n' +
        'Set it in your .env file or export it:\n' +
        '  export ANTHROPIC_API_KEY=sk-ant-...'
      )
    }
    _client = new Anthropic({ apiKey })
  }
  return _client
}

/**
 * The model to use for Studio conversations.
 * Claude Opus 4.6 provides the best agentic performance for tool use.
 */
export const STUDIO_MODEL = 'claude-sonnet-4-5-20250929' as const

/**
 * Max tokens for Studio responses.
 * 4096 is enough for tool calls + explanatory text.
 */
export const MAX_TOKENS = 4096
