/**
 * Contact Service Types
 *
 * Type definitions for the ContactService.
 * Defines types for contact management including company relationships,
 * communication preferences, and contact details.
 *
 * @module ContactTypes
 */

// Type literals for select fields
export type PreferredChannel =
  | 'email'
  | 'phone'
  | 'whatsapp'
  | 'linkedin'
  | 'slack'
  | 'other'

// Main entity interface
export interface Contact {
  id: string
  teamId: string
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  mobile?: string | null
  companyId?: string | null
  position?: string | null
  department?: string | null
  isPrimary?: boolean | null
  birthDate?: string | null
  linkedin?: string | null
  twitter?: string | null
  preferredChannel?: PreferredChannel | null
  timezone?: string | null
  lastContactedAt?: string | null
  createdAt: string
  updatedAt: string
}

// List options
export interface ContactListOptions {
  limit?: number
  offset?: number
  teamId?: string
  companyId?: string
  position?: string
  department?: string
  isPrimary?: boolean
  preferredChannel?: PreferredChannel
  orderBy?:
    | 'firstName'
    | 'lastName'
    | 'email'
    | 'phone'
    | 'position'
    | 'department'
    | 'lastContactedAt'
    | 'createdAt'
    | 'updatedAt'
  orderDir?: 'asc' | 'desc'
}

// List result
export interface ContactListResult {
  contacts: Contact[]
  total: number
}

// Create data (required fields + teamId + optional fields)
export interface ContactCreateData {
  firstName: string
  lastName: string
  email: string
  teamId: string
  phone?: string
  mobile?: string
  companyId?: string
  position?: string
  department?: string
  isPrimary?: boolean
  birthDate?: string
  linkedin?: string
  twitter?: string
  preferredChannel?: PreferredChannel
  timezone?: string
}

// Update data (all fields optional)
export interface ContactUpdateData {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string | null
  mobile?: string | null
  companyId?: string | null
  position?: string | null
  department?: string | null
  isPrimary?: boolean | null
  birthDate?: string | null
  linkedin?: string | null
  twitter?: string | null
  preferredChannel?: PreferredChannel | null
  timezone?: string | null
  lastContactedAt?: string | null
}
