/**
 * Note Service Types
 *
 * Type definitions for the NoteService.
 * Defines types for note management with flexible entity relationships,
 * privacy controls, and attachment support.
 *
 * @module NoteTypes
 */

// Type literals for select fields
export type NoteType =
  | 'general'
  | 'call'
  | 'meeting'
  | 'email'
  | 'followup'
  | 'feedback'
  | 'reminder'

export type NoteEntityType = 'lead' | 'contact' | 'company' | 'opportunity' | 'campaign'

// Attachment interface
export interface NoteAttachment {
  name: string
  url: string
  size?: number
  type?: string
}

// Main entity interface
export interface Note {
  id: string
  teamId: string
  title?: string | null
  content: string
  type?: NoteType | null
  isPinned?: boolean | null
  isPrivate?: boolean | null
  entityType?: NoteEntityType | null
  entityId?: string | null
  contactId?: string | null
  companyId?: string | null
  opportunityId?: string | null
  attachments?: NoteAttachment[] | null
  createdAt: string
  updatedAt: string
}

// List options
export interface NoteListOptions {
  limit?: number
  offset?: number
  teamId?: string
  type?: NoteType
  isPinned?: boolean
  isPrivate?: boolean
  entityType?: NoteEntityType
  entityId?: string
  contactId?: string
  companyId?: string
  opportunityId?: string
  orderBy?: 'title' | 'type' | 'isPinned' | 'isPrivate' | 'createdAt' | 'updatedAt'
  orderDir?: 'asc' | 'desc'
}

// List result
export interface NoteListResult {
  notes: Note[]
  total: number
}

// Create data (required fields + teamId + optional fields)
export interface NoteCreateData {
  content: string
  teamId: string
  title?: string
  type?: NoteType
  isPinned?: boolean
  isPrivate?: boolean
  entityType?: NoteEntityType
  entityId?: string
  contactId?: string
  companyId?: string
  opportunityId?: string
  attachments?: NoteAttachment[]
}

// Update data (all fields optional)
export interface NoteUpdateData {
  title?: string | null
  content?: string
  type?: NoteType | null
  isPinned?: boolean | null
  isPrivate?: boolean | null
  entityType?: NoteEntityType | null
  entityId?: string | null
  contactId?: string | null
  companyId?: string | null
  opportunityId?: string | null
  attachments?: NoteAttachment[] | null
}
