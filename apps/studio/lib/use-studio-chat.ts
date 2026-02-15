/**
 * React hook for Studio full flow:
 * AI analysis → project generation → file browsing → preview
 *
 * Sends to /api/generate which streams AI + create-nextspark-app output.
 */

'use client'

import { useState, useCallback, useRef } from 'react'
import type { StudioState, ChatMessage, StudioEvent, StudioResult, ProjectState } from './types'

let messageIdCounter = 0
function nextId(): string {
  return `msg-${++messageIdCounter}-${Date.now()}`
}

const INITIAL_PROJECT: ProjectState = {
  slug: null,
  phase: 'idle',
  files: [],
  previewUrl: null,
  previewLoading: false,
}

export function useStudioChat() {
  const [state, setState] = useState<StudioState>({
    status: 'idle',
    messages: [],
    result: null,
    error: null,
    project: { ...INITIAL_PROJECT },
  })

  const abortRef = useRef<AbortController | null>(null)

  const sendPrompt = useCallback(async (prompt: string) => {
    const userMessage: ChatMessage = {
      id: nextId(),
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    }

    setState({
      status: 'loading',
      messages: [userMessage],
      result: null,
      error: null,
      project: { ...INITIAL_PROJECT },
    })

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error || `HTTP ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      setState((prev) => ({ ...prev, status: 'streaming' }))

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6)
          try {
            const event = JSON.parse(jsonStr)
            processEvent(event)
          } catch {
            // skip malformed
          }
        }
      }

      // Remaining buffer
      if (buffer.startsWith('data: ')) {
        try {
          const event = JSON.parse(buffer.slice(6))
          processEvent(event)
        } catch {
          // skip
        }
      }

      setState((prev) => ({
        ...prev,
        status: prev.error ? 'error' : 'complete',
      }))
    } catch (error) {
      if ((error as Error).name === 'AbortError') return

      const message = error instanceof Error ? error.message : String(error)
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: message,
      }))
    }
  }, [])

  function processEvent(event: StudioEvent) {
    setState((prev) => {
      const messages = [...prev.messages]
      let result = prev.result
      let project = { ...prev.project }

      switch (event.type) {
        case 'text': {
          const last = messages[messages.length - 1]
          if (last?.role === 'assistant' && !last.toolName) {
            messages[messages.length - 1] = {
              ...last,
              content: last.content + (event.content || ''),
            }
          } else {
            messages.push({
              id: nextId(),
              role: 'assistant',
              content: event.content || '',
              timestamp: Date.now(),
            })
          }
          break
        }

        case 'tool_start': {
          messages.push({
            id: nextId(),
            role: 'tool',
            content: event.content || `Running ${event.toolName}...`,
            toolName: event.toolName,
            timestamp: Date.now(),
          })
          break
        }

        case 'tool_result': {
          const toolIdx = messages.findLastIndex(
            (m) => m.role === 'tool' && m.toolName === event.toolName
          )
          if (toolIdx >= 0) {
            messages[toolIdx] = {
              ...messages[toolIdx],
              content: event.content || 'Done',
            }
          }
          break
        }

        case 'generation_complete': {
          result = (event.data as StudioResult) || null
          break
        }

        case 'phase': {
          messages.push({
            id: nextId(),
            role: 'system',
            content: event.content || event.phase || 'Processing...',
            timestamp: Date.now(),
          })
          if (event.phase === 'generating') {
            project = { ...project, phase: 'generating' }
          } else if (event.phase === 'analyzing') {
            project = { ...project, phase: 'analyzing' }
          }
          break
        }

        case 'generate_log': {
          // Append to last system message or create new
          const lastSys = messages[messages.length - 1]
          if (lastSys?.role === 'system' && !lastSys.content.startsWith('Project')) {
            // Replace the last system message (log lines)
            messages[messages.length - 1] = {
              ...lastSys,
              content: event.content || '',
            }
          } else {
            messages.push({
              id: nextId(),
              role: 'system',
              content: event.content || '',
              timestamp: Date.now(),
            })
          }
          break
        }

        case 'project_ready': {
          const slug = event.slug || ''
          project = {
            ...project,
            slug,
            phase: 'ready',
          }
          messages.push({
            id: nextId(),
            role: 'system',
            content: event.content || `Project "${slug}" is ready!`,
            timestamp: Date.now(),
          })
          break
        }

        case 'error': {
          return {
            ...prev,
            messages,
            error: event.content || 'Unknown error',
            project: { ...project, phase: 'error' },
          }
        }
      }

      return { ...prev, messages, result, project }
    })
  }

  // Fetch file tree for the generated project
  const fetchFiles = useCallback(async (slug: string) => {
    try {
      const res = await fetch(`/api/files?slug=${encodeURIComponent(slug)}`)
      if (!res.ok) return
      const data = await res.json()
      setState((prev) => ({
        ...prev,
        project: { ...prev.project, files: data.files || [] },
      }))
    } catch {
      // ignore
    }
  }, [])

  // Start preview server
  const startPreview = useCallback(async (slug: string) => {
    setState((prev) => ({
      ...prev,
      project: { ...prev.project, previewLoading: true },
    }))

    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', slug }),
      })

      if (!res.ok) {
        setState((prev) => ({
          ...prev,
          project: { ...prev.project, previewLoading: false },
        }))
        return
      }

      const data = await res.json()
      setState((prev) => ({
        ...prev,
        project: {
          ...prev.project,
          previewUrl: data.url || null,
          previewLoading: false,
        },
      }))
    } catch {
      setState((prev) => ({
        ...prev,
        project: { ...prev.project, previewLoading: false },
      }))
    }
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState({
      status: 'idle',
      messages: [],
      result: null,
      error: null,
      project: { ...INITIAL_PROJECT },
    })
  }, [])

  return {
    ...state,
    sendPrompt,
    reset,
    fetchFiles,
    startPreview,
  }
}
