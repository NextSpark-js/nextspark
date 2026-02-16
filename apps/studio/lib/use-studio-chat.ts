/**
 * React hook for Studio full flow:
 * AI analysis -> project generation -> file browsing -> preview -> iterative chat
 *
 * Phase 1 (generation): Sends to /api/generate which streams AI + project generation output.
 * Phase 2 (chat): Sends to /api/chat which lets AI read/modify project files.
 * Supports session persistence: load from DB on mount, auto-save during generation.
 */

'use client'

import { useState, useCallback, useRef } from 'react'
import type { StudioState, ChatMessage, StudioEvent, StudioResult, ProjectState, PageDefinition, GenerationStep } from './types'

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
  steps: [],
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

let stepIdCounter = 0
function nextStepId(): string {
  return `step-${++stepIdCounter}`
}

function updateSteps(
  steps: GenerationStep[],
  action: 'add' | 'complete_active' | 'complete_all' | 'update_detail',
  data?: Partial<GenerationStep> & { label?: string }
): GenerationStep[] {
  const updated = steps.map((s) => ({ ...s }))

  if (action === 'complete_all') {
    return updated.map((s) => ({ ...s, status: 'complete' as const }))
  }

  if (action === 'complete_active') {
    return updated.map((s) =>
      s.status === 'active' ? { ...s, status: 'complete' as const } : s
    )
  }

  if (action === 'update_detail') {
    // Update the detail on the last active step
    const activeIdx = updated.findLastIndex((s) => s.status === 'active')
    if (activeIdx >= 0 && data?.detail !== undefined) {
      updated[activeIdx] = { ...updated[activeIdx], detail: data.detail }
    }
    return updated
  }

  if (action === 'add' && data?.label) {
    // Mark all active as complete, then add new active step
    const completed = updated.map((s) =>
      s.status === 'active' ? { ...s, status: 'complete' as const } : s
    )
    // Check if a step with this label already exists (for incrementing counts)
    const existing = completed.findIndex((s) => s.label === data.label)
    if (existing >= 0) {
      completed[existing] = {
        ...completed[existing],
        status: 'active',
        count: (completed[existing].count || 1) + 1,
      }
      return completed
    }
    completed.push({
      id: nextStepId(),
      label: data.label,
      status: 'active',
      ...(data.count !== undefined ? { count: data.count } : {}),
      ...(data.icon !== undefined ? { icon: data.icon } : {}),
    })
    return completed
  }

  return updated
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
   * Returns { id, prompt } if the session is fresh (needs generation),
   * the session ID string if it's a completed/in-progress session,
   * or null if not found.
   */
  const loadSession = useCallback(async (id: string): Promise<string | { id: string; prompt: string } | null> => {
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`)
      if (!res.ok) return null

      const { session } = await res.json()
      if (!session) return null

      // Fresh session (just created from home page) — needs generation
      if (session.status === 'loading' && session.prompt && !session.result) {
        setSessionId(id)
        return { id, prompt: session.prompt }
      }

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
          steps: [],
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

  const sendPrompt = useCallback(async (prompt: string, existingSessionId?: string) => {
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

    // Use existing session ID or generate a new one
    const sid = existingSessionId || generateUUID()
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

  /**
   * Send a chat message for post-generation project modification.
   * Routes to /api/chat instead of /api/generate.
   * Maintains conversation history for context.
   */
  const sendChatMessage = useCallback(async (message: string) => {
    const slug = state.project.slug
    if (!slug) return

    const userMessage: ChatMessage = {
      id: nextId(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
    }

    setState((prev) => ({
      ...prev,
      status: 'streaming',
      error: null,
      messages: [...prev.messages, userMessage],
    }))

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    // Build conversation history from previous messages (user + assistant only)
    const history = state.messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          message,
          history,
          sessionId: sessionId,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error || `HTTP ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let filesWereModified = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6)) as StudioEvent
            if (event.type === 'files_modified') {
              filesWereModified = true
            }
            processChatEvent(event)
          } catch {
            // skip malformed
          }
        }
      }

      // Process remaining buffer
      if (buffer.startsWith('data: ')) {
        try {
          const event = JSON.parse(buffer.slice(6)) as StudioEvent
          if (event.type === 'files_modified') {
            filesWereModified = true
          }
          processChatEvent(event)
        } catch {
          // skip
        }
      }

      setState((prev) => ({
        ...prev,
        status: 'complete',
      }))

      // Refresh file tree if files were modified
      if (filesWereModified) {
        fetchFiles(slug)
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return

      const msg = error instanceof Error ? error.message : String(error)
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: msg,
      }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.project.slug, state.messages, sessionId, fetchFiles])

  /**
   * Process SSE events from the chat API.
   * Handles text, tool_start, tool_result, files_modified, chat_complete, and error events.
   */
  function processChatEvent(event: StudioEvent) {
    setState((prev) => {
      const messages = [...prev.messages]

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

        case 'files_modified': {
          const fileList = event.filesModified?.join(', ') || ''
          messages.push({
            id: nextId(),
            role: 'system',
            content: `Modified files: ${fileList}`,
            timestamp: Date.now(),
          })
          break
        }

        case 'chat_complete': {
          // Chat turn complete — no special handling needed
          break
        }

        case 'error': {
          // Ignore empty error events (e.g. from agent end_turn)
          if (!event.content) break
          return {
            ...prev,
            messages,
            error: event.content,
          }
        }
      }

      return { ...prev, messages }
    })
  }

  function processEvent(event: StudioEvent) {
    setState((prev) => {
      const messages = [...prev.messages]
      let result = prev.result
      let project = { ...prev.project }
      let pages = prev.pages
      let steps = [...project.steps]

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
          // Track steps based on tool name
          if (event.toolName === 'configure_project') {
            steps = updateSteps(steps, 'add', { label: 'Configuring project', icon: 'settings' })
          } else if (event.toolName === 'define_entity') {
            steps = updateSteps(steps, 'add', { label: 'Defining entities', icon: 'database' })
          } else if (event.toolName === 'define_page') {
            steps = updateSteps(steps, 'add', { label: 'Defining pages', icon: 'layout' })
          }
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
          // Mark all analysis steps complete, extract counts
          steps = updateSteps(steps, 'complete_active')
          const entityCount = studioResult?.entities?.length
          const pageCount = studioResult?.pages?.length
          if (entityCount) {
            const entityStep = steps.find((s) => s.label === 'Defining entities')
            if (entityStep) entityStep.count = entityCount
          }
          if (pageCount) {
            const pageStep = steps.find((s) => s.label === 'Defining pages')
            if (pageStep) pageStep.count = pageCount
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
            steps = updateSteps(steps, 'add', { label: 'Generating project files', icon: 'code' })
          } else if (event.phase === 'analyzing') {
            project = { ...project, phase: 'analyzing' }
            steps = updateSteps(steps, 'add', { label: 'Analyzing requirements', icon: 'search' })
          }
          break
        }

        case 'generate_log': {
          const logContent = event.content || ''

          // Append to last system message or create new
          const lastSys = messages[messages.length - 1]
          if (lastSys?.role === 'system' && !lastSys.content.startsWith('Project')) {
            // Replace the last system message (log lines)
            messages[messages.length - 1] = {
              ...lastSys,
              content: logContent,
            }
          } else {
            messages.push({
              id: nextId(),
              role: 'system',
              content: logContent,
              timestamp: Date.now(),
            })
          }

          // Create granular steps from structured log prefixes
          if (logContent.includes('Installing dependencies')) {
            steps = updateSteps(steps, 'add', { label: 'Installing dependencies', icon: 'package' })
          } else if (logContent.includes('Building registries')) {
            steps = updateSteps(steps, 'add', { label: 'Building registries', icon: 'database' })
          } else if (logContent.includes('Project ready!')) {
            steps = updateSteps(steps, 'complete_active')
          } else {
            // Update detail on active generating step
            steps = updateSteps(steps, 'update_detail', { detail: logContent })
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
          steps = updateSteps(steps, 'complete_all')
          messages.push({
            id: nextId(),
            role: 'system',
            content: event.content || `Project "${slug}" is ready!`,
            timestamp: Date.now(),
          })
          break
        }

        case 'error': {
          // Mark current active step with error detail
          const errorSteps = steps.map((s) =>
            s.status === 'active' ? { ...s, detail: event.content || 'Error occurred' } : s
          )
          return {
            ...prev,
            messages,
            error: event.content || 'Unknown error',
            project: { ...project, phase: 'error', steps: errorSteps },
            pages,
          }
        }
      }

      project = { ...project, steps }
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
    sendChatMessage,
    reset,
    fetchFiles,
    startPreview,
    updatePages,
    loadSession,
  }
}
