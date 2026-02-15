/**
 * React hook for GitHub integration.
 *
 * Manages OAuth state, user info, and push-to-GitHub flow.
 */

'use client'

import { useState, useCallback, useEffect } from 'react'

export interface GitHubUser {
  login: string
  avatar_url: string
  name: string | null
  html_url: string
}

export type PushStep = 'idle' | 'creating_repo' | 'sanitizing' | 'initializing' | 'staging' | 'committing' | 'pushing' | 'cleaning' | 'done' | 'error'

export interface PushResult {
  url: string
  cloneUrl: string
  fullName: string
}

interface GitHubState {
  configured: boolean
  authenticated: boolean
  user: GitHubUser | null
  loading: boolean
  pushStep: PushStep
  pushError: string | null
  pushResult: PushResult | null
}

export function useGitHub() {
  const [state, setState] = useState<GitHubState>({
    configured: false,
    authenticated: false,
    user: null,
    loading: true,
    pushStep: 'idle',
    pushError: null,
    pushResult: null,
  })

  // Check auth status on mount
  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }))
    try {
      const res = await fetch('/api/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' }),
      })
      const data = await res.json()
      setState((prev) => ({
        ...prev,
        configured: data.configured ?? false,
        authenticated: data.authenticated ?? false,
        user: data.user ?? null,
        loading: false,
      }))
    } catch {
      setState((prev) => ({ ...prev, loading: false }))
    }
  }, [])

  const connect = useCallback(async () => {
    try {
      const res = await fetch('/api/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auth-url' }),
      })
      const data = await res.json()
      if (data.url) {
        // Open in same window (OAuth will redirect back)
        window.location.href = data.url
      } else if (data.error) {
        setState((prev) => ({ ...prev, pushError: data.error }))
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        pushError: error instanceof Error ? error.message : 'Failed to connect',
      }))
    }
  }, [])

  const disconnect = useCallback(async () => {
    await fetch('/api/github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disconnect' }),
    })
    setState((prev) => ({
      ...prev,
      authenticated: false,
      user: null,
    }))
  }, [])

  const push = useCallback(async (options: {
    slug: string
    repoName: string
    description?: string
    isPrivate?: boolean
    sanitizeEnv?: boolean
    addReadme?: boolean
  }) => {
    setState((prev) => ({
      ...prev,
      pushStep: 'creating_repo',
      pushError: null,
      pushResult: null,
    }))

    try {
      const res = await fetch('/api/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'push', ...options }),
      })

      const data = await res.json()

      if (!res.ok) {
        setState((prev) => ({
          ...prev,
          pushStep: 'error',
          pushError: data.error || 'Push failed',
        }))
        return
      }

      setState((prev) => ({
        ...prev,
        pushStep: 'done',
        pushResult: data.repo,
      }))
    } catch (error) {
      setState((prev) => ({
        ...prev,
        pushStep: 'error',
        pushError: error instanceof Error ? error.message : 'Push failed',
      }))
    }
  }, [])

  const resetPush = useCallback(() => {
    setState((prev) => ({
      ...prev,
      pushStep: 'idle',
      pushError: null,
      pushResult: null,
    }))
  }, [])

  return {
    ...state,
    connect,
    disconnect,
    push,
    resetPush,
    checkStatus,
  }
}
