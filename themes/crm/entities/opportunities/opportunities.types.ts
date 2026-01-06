/**
 * Opportunity Service Types
 *
 * Type definitions for the OpportunityService.
 * Defines types for sales opportunity management including pipeline tracking,
 * deal amounts, and win probability calculations.
 *
 * @module OpportunityTypes
 */

// Type literals for select fields
export type OpportunityStatus = 'open' | 'won' | 'lost' | 'abandoned'

export type OpportunityType =
  | 'new_business'
  | 'existing_business'
  | 'renewal'
  | 'upgrade'
  | 'downgrade'

export type OpportunitySource =
  | 'web'
  | 'referral'
  | 'cold_call'
  | 'trade_show'
  | 'social_media'
  | 'email'
  | 'advertising'
  | 'partner'
  | 'other'

export type Currency =
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'MXN'
  | 'CAD'
  | 'AUD'
  | 'JPY'
  | 'CNY'
  | 'INR'
  | 'BRL'

// Main entity interface
export interface Opportunity {
  id: string
  teamId: string
  name: string
  companyId: string
  contactId?: string | null
  pipelineId: string
  stageId: string
  amount: number
  currency?: Currency | null
  probability?: number | null
  expectedRevenue?: number | null
  closeDate: string
  type?: OpportunityType | null
  source?: OpportunitySource | null
  competitor?: string | null
  status?: OpportunityStatus | null
  lostReason?: string | null
  assignedTo?: string | null
  createdAt: string
  updatedAt: string
}

// List options
export interface OpportunityListOptions {
  limit?: number
  offset?: number
  teamId?: string
  companyId?: string
  contactId?: string
  pipelineId?: string
  stageId?: string
  status?: OpportunityStatus
  type?: OpportunityType
  source?: OpportunitySource
  currency?: Currency
  assignedTo?: string
  orderBy?:
    | 'name'
    | 'amount'
    | 'probability'
    | 'expectedRevenue'
    | 'closeDate'
    | 'createdAt'
    | 'updatedAt'
  orderDir?: 'asc' | 'desc'
}

// List result
export interface OpportunityListResult {
  opportunities: Opportunity[]
  total: number
}

// Create data (required fields + teamId + optional fields)
export interface OpportunityCreateData {
  name: string
  companyId: string
  pipelineId: string
  stageId: string
  amount: number
  closeDate: string
  teamId: string
  contactId?: string
  currency?: Currency
  probability?: number
  type?: OpportunityType
  source?: OpportunitySource
  competitor?: string
  status?: OpportunityStatus
  assignedTo?: string
}

// Update data (all fields optional)
export interface OpportunityUpdateData {
  name?: string
  companyId?: string
  contactId?: string | null
  pipelineId?: string
  stageId?: string
  amount?: number
  currency?: Currency | null
  probability?: number | null
  closeDate?: string
  type?: OpportunityType | null
  source?: OpportunitySource | null
  competitor?: string | null
  status?: OpportunityStatus | null
  lostReason?: string | null
  assignedTo?: string | null
}
