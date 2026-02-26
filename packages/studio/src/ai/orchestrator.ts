/**
 * Studio Orchestrator
 *
 * Uses the Claude Agent SDK to manage the conversation loop automatically.
 * Our tools are exposed via an in-process MCP server, and the Agent SDK
 * handles tool dispatch, message management, and turn counting.
 *
 * Flow:
 * 1. Create MCP server with our 4 tools
 * 2. Call query() with system prompt + MCP server
 * 3. Agent SDK calls tools automatically, we collect results via closure
 * 4. Return collected StudioResult
 */

import { query } from '@anthropic-ai/claude-agent-sdk'
import { SYSTEM_PROMPT } from './system-prompt'
import { createStudioMcpServer, STUDIO_MCP_TOOL_NAMES } from './tools/mcp-server'
import type { StudioResult, StudioEventHandler } from '../types'

/**
 * Run a complete Studio conversation.
 *
 * Takes a user prompt, lets the Agent SDK orchestrate tool calls
 * via our MCP server, and returns the collected configuration.
 */
export async function runStudio(
  userPrompt: string,
  onEvent?: StudioEventHandler
): Promise<StudioResult> {
  // Allow Agent SDK to spawn Claude Code even when called from within a Claude Code session
  delete process.env.CLAUDECODE

  const result: StudioResult = {}
  const mcpServer = createStudioMcpServer(result, onEvent)

  for await (const message of query({
    prompt: userPrompt,
    options: {
      systemPrompt: SYSTEM_PROMPT,
      mcpServers: { studio: mcpServer },
      allowedTools: [...STUDIO_MCP_TOOL_NAMES],
      permissionMode: 'bypassPermissions',
      maxTurns: 15,
    },
  })) {
    // Emit text from Claude's assistant responses
    if (message.type === 'assistant' && message.message?.content) {
      for (const block of message.message.content) {
        if (typeof block === 'object' && 'type' in block && block.type === 'text' && 'text' in block) {
          onEvent?.({ type: 'text', content: block.text as string })
        }
      }
    }

    // Handle result messages
    if (message.type === 'result') {
      if (message.subtype !== 'success') {
        const errorMsg = 'errors' in message
          ? (message.errors as string[]).join('; ')
          : 'Unknown error'
        onEvent?.({ type: 'error', content: errorMsg })
      }
    }
  }

  return result
}
