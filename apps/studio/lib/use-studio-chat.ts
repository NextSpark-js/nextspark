/**
 * React hook for Studio full flow:
 * AI analysis -> project generation -> file browsing -> preview
 *
 * Sends to /api/generate which streams AI + create-nextspark-app output.
 * Supports session persistence: load from DB on mount, auto-save during generation.
 */

'use client'

import { useState, useCallback, useRef } from 'react'
import type { StudioState, ChatMessage, StudioEvent, StudioResult, ProjectState, PageDefinition } from './types'

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
    pages: [],
  })

  const [sessionId, setSessionId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Track the slug from SSE events so we can fetch files after stream ends
  const readySlugRef = useRef<string | null>(null)

  const fetchFiles = useCallback(async (slug: string) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 1000 * attempt))
        }
        const res = await fetch(`/api/files?slug=${encodeURIComponent(slug)}`)
        if (!res.ok) continue
        const data = await res.json()
        const files = data.files || []
        if (files.length > 0) {
          setState((prev) => ({
            ...prev,
            project: { ...prev.project, files },
          }))
          return
        }
      } catch {
        // retry
      }
    }
  }, [])

  const updatePages = useCallback((pages: PageDefinition[]) => {
    setState((prev) => ({ ...prev, pages }))
  }, [])

  /**
   * Load an existing session from the DB.
   * Returns the session ID if found, null otherwise.
   */
  const loadSession = useCallback(async (id: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`)
      if (!res.ok) return null

      const { session } = await res.json()
      if (!session) return null

      const messages: ChatMessage[] = Array.isArray(session.messages)
        ? session.messages
        : []
      const pages: PageDefinition[] = Array.isArray(session.pages)
        ? session.pages
        : []
      const result: StudioResult | null = session.result || null
      const slug: string | null = session.project_slug || null
      const error: string | null = session.error || null

      // Map DB status to UI status
      let status: StudioState['status'] = 'idle'
      if (session.status === 'complete') status = 'complete'
      else if (session.status === 'error') status = 'error'
      else if (session.status === 'streaming' || session.status === 'generating') status = 'streaming'
      else if (session.status === 'loading') status = 'loading'

      // Determine project phase
      let phase: ProjectState['phase'] = 'idle'
      if (slug && (status === 'complete')) phase = 'ready'
      else if (status === 'error') phase = 'error'
      else if (status === 'streaming') phase = 'generating'

      setState({
        status,
        messages,
        result,
        error,
        project: {
          slug,
          phase,
          files: [],
          previewUrl: null,
          previewLoading: false,
        },
        pages,
      })

      setSessionId(id)

      // Fetch files if project is ready
      if (slug && phase === 'ready') {
        fetchFiles(slug)
      }

      return id
    } catch {
      return null
    }
  }, [fetchFiles])

  /**
   * Save the current messages to the session (called after stream completes).
   */
  const saveMessages = useCallback(async (sid: string, messages: ChatMessage[]) => {
    try {
      await fetch(`/api/sessions/${encodeURIComponent(sid)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      })
    } catch {
      // Best-effort
    }
  }, [])

  const sendPrompt = useCallback(async (prompt: string) => {
    const userMessage: ChatMessage = {
      id: nextId(),
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    }

    readySlugRef.current = null

    setState({
      status: 'loading',
      messages: [userMessage],
      result: null,
      error: null,
      project: { ...INITIAL_PROJECT },
      pages: [],
    })

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    // Generate a session ID upfront
    const sid = crypto.randomUUID()
    setSessionId(sid)

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, sessionId: sid }),
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
            // Track slug synchronously (outside setState)
            if (event.type === 'project_ready' && event.slug) {
              readySlugRef.current = event.slug
            }
            // session_init event — update URL
            if (event.type === 'session_init' && event.sessionId) {
              // URL update is handled by the build page component
            }
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
          if (event.type === 'project_ready' && event.slug) {
            readySlugRef.current = event.slug
          }
          processEvent(event)
        } catch {
          // skip
        }
      }

      setState((prev) => {
        const finalStatus = prev.error ? 'error' : 'complete'
        // Save messages to session after stream completes
        saveMessages(sid, prev.messages)
        return { ...prev, status: finalStatus }
      })

      // Fetch files immediately after stream completes (not via useEffect)
      const slug = readySlugRef.current
      if (slug) {
        fetchFiles(slug)
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return

      const message = error instanceof Error ? error.message : String(error)
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: message,
      }))
    }
  }, [fetchFiles, saveMessages])

  function processEvent(event: StudioEvent) {
    setState((prev) => {
      const messages = [...prev.messages]
      let result = prev.result
      let project = { ...prev.project }
      let pages = prev.pages

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
          const studioResult = (event.data as StudioResult) || null
          result = studioResult
          // Extract pages from studio result
          if (studioResult?.pages && studioResult.pages.length > 0) {
            pages = studioResult.pages
          }
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
            pages,
          }
        }
      }

      return { ...prev, messages, result, project, pages }
    })
  }

  // Set up database + start preview server
  const startPreview = useCallback(async (slug: string) => {
    setState((prev) => ({
      ...prev,
      project: { ...prev.project, previewLoading: true, phase: 'setting_up_db' },
    }))

    // Step 1: Set up the database (create DB, migrate, seed)
    let setupPort: number | undefined
    try {
      const setupRes = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup', slug }),
      })

      if (setupRes.ok) {
        const setupData = await setupRes.json()
        setupPort = setupData.port
      }
      // If setup fails, continue anyway - preview will work without DB
    } catch {
      // DB setup is best-effort, don't block preview
    }

    // Step 2: Start the dev server
    setState((prev) => ({
      ...prev,
      project: { ...prev.project, phase: 'ready' },
    }))

    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', slug, port: setupPort }),
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
    readySlugRef.current = null
    setSessionId(null)
    setState({
      status: 'idle',
      messages: [],
      result: null,
      error: null,
      project: { ...INITIAL_PROJECT },
      pages: [],
    })
  }, [])

  return {
    ...state,
    sessionId,
    sendPrompt,
    reset,
    fetchFiles,
    startPreview,
    updatePages,
    loadSession,
  }
}
