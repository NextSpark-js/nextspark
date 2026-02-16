/**
 * Chat Orchestrator
 *
 * Uses the Claude Agent SDK to handle post-generation iterative chat.
 * Provides file manipulation tools scoped to the project directory.
 * Maintains conversation history across turns.
 *
 * Flow:
 * 1. Build system prompt with project context
 * 2. Format conversation history into the prompt
 * 3. Create MCP server with file tools
 * 4. Call query() with system prompt + file tools
 * 5. Stream responses back to the client
 */

import { query } from '@anthropic-ai/claude-agent-sdk'
import { buildChatSystemPrompt } from './chat-system-prompt'
import { createChatMcpServer, CHAT_MCP_TOOL_NAMES } from './tools/chat-tools'
import type { StudioEventHandler, StudioResult } from '../types'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  projectDir: string
  projectSlug: string
  themeName: string
  studioResult?: StudioResult
  history?: ChatMessage[]
}

/**
 * Run a chat turn for project modification.
 *
 * Takes the user's message plus conversation history and project context,
 * lets Claude use file tools to inspect and modify the project.
 */
export async function runChat(
  userMessage: string,
  options: ChatOptions,
  onEvent?: StudioEventHandler
): Promise<{ response: string; filesModified: string[] }> {
  // Allow Agent SDK to spawn even within Claude Code
  delete process.env.CLAUDECODE

  const filesModified: string[] = []
  let responseText = ''

  // Build system prompt with project context
  const systemPrompt = buildChatSystemPrompt({
    projectSlug: options.projectSlug,
    themeName: options.themeName,
    wizardConfig: options.studioResult?.wizardConfig as Record<string, unknown> | undefined,
    entities: options.studioResult?.entities?.map(e => ({
      slug: e.slug,
      fields: e.fields.map(f => ({ name: f.name, type: f.type })),
    })),
    pages: options.studioResult?.pages?.map(p => ({
      pageName: p.pageName,
      route: p.route,
    })),
  })

  // Format conversation history into the prompt
  const historyText = options.history && options.history.length > 0
    ? options.history.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n')
    : ''

  const fullPrompt = historyText
    ? `Previous conversation:\n${historyText}\n\nUser: ${userMessage}`
    : userMessage

  // Create MCP server with file tools, wrapping write_file to track modifications
  const mcpServer = createChatMcpServer(options.projectDir, (event) => {
    // Track file modifications
    if (event?.type === 'tool_result' && event.toolName === 'write_file' && event.content?.startsWith('Wrote ')) {
      const filePath = event.content.replace(/^Wrote /, '').replace(/ \(\d+ chars\)$/, '')
      if (!filesModified.includes(filePath)) {
        filesModified.push(filePath)
      }
    }
    onEvent?.(event)
  })

  for await (const message of query({
    prompt: fullPrompt,
    options: {
      systemPrompt,
      mcpServers: { project: mcpServer },
      allowedTools: [...CHAT_MCP_TOOL_NAMES],
      permissionMode: 'bypassPermissions',
      maxTurns: 10,
    },
  })) {
    if (message.type === 'assistant' && message.message?.content) {
      for (const block of message.message.content) {
        if (typeof block === 'object' && 'type' in block && block.type === 'text' && 'text' in block) {
          const text = block.text as string
          responseText += text
          onEvent?.({ type: 'text', content: text })
        }
      }
    }

    if (message.type === 'result') {
      if (message.subtype !== 'success') {
        const errorMsg = 'errors' in message
          ? (message.errors as string[]).join('; ')
          : 'Unknown error'
        onEvent?.({ type: 'error', content: errorMsg })
      }
    }
  }

  return { response: responseText, filesModified }
}
