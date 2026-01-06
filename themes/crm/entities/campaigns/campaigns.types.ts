/**
 * Campaign Service Types
 *
 * Type definitions for the CampaignService.
 * Defines types for marketing campaign management including budget tracking,
 * lead generation metrics, and ROI calculations.
 *
 * @module CampaignTypes
 */

// Type literals for select fields
export type CampaignType =
  | 'email'
  | 'social'
  | 'event'
  | 'webinar'
  | 'advertising'
  | 'content'
  | 'other'

export type CampaignStatus = 'planned' | 'active' | 'paused' | 'completed' | 'cancelled'

export type CampaignChannel =
  | 'email'
  | 'social_media'
  | 'web'
  | 'print'
  | 'tv'
  | 'radio'
  | 'other'

// Main entity interface
export interface Campaign {
  id: string
  teamId: string
  name: string
  type?: CampaignType | null
  status?: CampaignStatus | null
  objective?: string | null
  description?: string | null
  startDate: string
  endDate: string
  budget?: number | null
  actualCost?: number | null
  targetAudience?: string | null
  targetLeads?: number | null
  actualLeads?: number | null
  targetRevenue?: number | null
  actualRevenue?: number | null
  roi?: number | null
  channel?: CampaignChannel | null
  assignedTo?: string | null
  createdAt: string
  updatedAt: string
}

// List options
export interface CampaignListOptions {
  limit?: number
  offset?: number
  teamId?: string
  type?: CampaignType
  status?: CampaignStatus
  channel?: CampaignChannel
  assignedTo?: string
  orderBy?:
    | 'name'
    | 'startDate'
    | 'endDate'
    | 'budget'
    | 'actualCost'
    | 'actualLeads'
    | 'roi'
    | 'createdAt'
    | 'updatedAt'
  orderDir?: 'asc' | 'desc'
}

// List result
export interface CampaignListResult {
  campaigns: Campaign[]
  total: number
}

// Create data (required fields + teamId + optional fields)
export interface CampaignCreateData {
  name: string
  startDate: string
  endDate: string
  teamId: string
  type?: CampaignType
  status?: CampaignStatus
  objective?: string
  description?: string
  budget?: number
  actualCost?: number
  targetAudience?: string
  targetLeads?: number
  actualLeads?: number
  targetRevenue?: number
  actualRevenue?: number
  channel?: CampaignChannel
  assignedTo?: string
}

// Update data (all fields optional)
export interface CampaignUpdateData {
  name?: string
  type?: CampaignType | null
  status?: CampaignStatus | null
  objective?: string | null
  description?: string | null
  startDate?: string
  endDate?: string
  budget?: number | null
  actualCost?: number | null
  targetAudience?: string | null
  targetLeads?: number | null
  actualLeads?: number | null
  targetRevenue?: number | null
  actualRevenue?: number | null
  channel?: CampaignChannel | null
  assignedTo?: string | null
}
