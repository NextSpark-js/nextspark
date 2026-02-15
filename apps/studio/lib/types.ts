/**
 * UI-specific types for NextSpark Studio
 */

import type { StudioResult, StudioEvent } from '@nextsparkjs/studio'

export type ChatMessageRole = 'user' | 'assistant' | 'tool' | 'system'

export interface ChatMessage {
  id: string
  role: ChatMessageRole
  content: string
  toolName?: string
  timestamp: number
}

export type StudioPhase = 'idle' | 'analyzing' | 'generating' | 'setting_up_db' | 'ready' | 'error'

export type StudioStatus = 'idle' | 'loading' | 'streaming' | 'complete' | 'error'

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

export interface ProjectState {
  slug: string | null
  phase: StudioPhase
  files: FileNode[]
  previewUrl: string | null
  previewLoading: boolean
}

export interface StudioState {
  status: StudioStatus
  messages: ChatMessage[]
  result: StudioResult | null
  error: string | null
  project: ProjectState
}

export type { StudioResult, StudioEvent }
