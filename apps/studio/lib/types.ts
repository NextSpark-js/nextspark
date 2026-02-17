/**
 * UI-specific types for NextSpark Studio
 */

import type { StudioResult, StudioEvent, PageDefinition, BlockInstance } from '@nextsparkjs/studio'

export type ChatMessageRole = 'user' | 'assistant' | 'tool' | 'system'

export interface ChatMessage {
  id: string
  role: ChatMessageRole
  content: string
  toolName?: string
  timestamp: number
}

export type StudioPhase = 'idle' | 'analyzing' | 'generating' | 'setting_up_db' | 'ready' | 'error'

export interface GenerationStep {
  id: string
  label: string
  status: 'pending' | 'active' | 'complete'
  detail?: string
  icon?: string
  count?: number
}

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
  previewStale: boolean
  steps: GenerationStep[]
}

export interface StudioState {
  status: StudioStatus
  messages: ChatMessage[]
  result: StudioResult | null
  error: string | null
  project: ProjectState
  pages: PageDefinition[]
}

export type { StudioResult, StudioEvent, PageDefinition, BlockInstance }
