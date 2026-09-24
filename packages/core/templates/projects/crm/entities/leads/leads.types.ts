/**
 * Lead Service Types
 *
 * Type definitions for the LeadService.
 * Defines types for lead management including source tracking,
 * status progression, and qualification scoring.
 *
 * @module LeadTypes
 */

// Type literals for select fields
export type LeadSource =
  | 'web'
  | 'referral'
  | 'cold_call'
  | 'trade_show'
  | 'social_media'
  | 'email'
  | 'advertising'
  | 'partner'
  | 'other'

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'converted'
  | 'lost'

export type CompanySize = '1-10' | '11-50' | '51-200' | '201-500' | '500+'

// Main entity interface
export interface Lead {
  id: string
  teamId: string
  companyName: string
  contactName: string
  email: string
  phone?: string | null
  website?: string | null
  source?: LeadSource | null
  status?: LeadStatus | null
  score?: number | null
  industry?: string | null
  companySize?: CompanySize | null
  budget?: number | null
  assignedTo?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

// List options
export interface LeadListOptions {
  limit?: number
  offset?: number
  teamId?: string
  source?: LeadSource
  status?: LeadStatus
  companySize?: CompanySize
  assignedTo?: string
  orderBy?:
    | 'companyName'
    | 'contactName'
    | 'email'
    | 'score'
    | 'industry'
    | 'createdAt'
    | 'updatedAt'
  orderDir?: 'asc' | 'desc'
}

// List result
export interface LeadListResult {
  leads: Lead[]
  total: number
}

// Create data (required fields + teamId + optional fields)
export interface LeadCreateData {
  companyName: string
  contactName: string
  email: string
  teamId: string
  phone?: string
  website?: string
  source?: LeadSource
  status?: LeadStatus
  score?: number
  industry?: string
  companySize?: CompanySize
  budget?: number
  assignedTo?: string
  notes?: string
}

// Update data (all fields optional)
export interface LeadUpdateData {
  companyName?: string
  contactName?: string
  email?: string
  phone?: string | null
  website?: string | null
  source?: LeadSource | null
  status?: LeadStatus | null
  score?: number | null
  industry?: string | null
  companySize?: CompanySize | null
  budget?: number | null
  assignedTo?: string | null
  notes?: string | null
}
