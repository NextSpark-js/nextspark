/**
 * Pipeline Service Types
 *
 * Type definitions for the PipelineService.
 * Defines types for sales pipeline management including stage configuration,
 * deal progression tracking, and pipeline customization.
 *
 * @module PipelineTypes
 */

// Type literals for select fields
export type PipelineType = 'sales' | 'support' | 'project' | 'custom'

// Pipeline stage interface
export interface PipelineStage {
  id: string
  name: string
  probability: number
  order: number
  isClosed?: boolean
  isWon?: boolean
}

// Main entity interface
export interface Pipeline {
  id: string
  teamId: string
  name: string
  description?: string | null
  type?: PipelineType | null
  isDefault?: boolean | null
  isActive?: boolean | null
  stages: PipelineStage[]
  dealRottenDays?: number | null
  createdAt: string
  updatedAt: string
}

// List options
export interface PipelineListOptions {
  limit?: number
  offset?: number
  teamId?: string
  type?: PipelineType
  isDefault?: boolean
  isActive?: boolean
  orderBy?: 'name' | 'type' | 'isDefault' | 'isActive' | 'createdAt' | 'updatedAt'
  orderDir?: 'asc' | 'desc'
}

// List result
export interface PipelineListResult {
  pipelines: Pipeline[]
  total: number
}

// Create data (required fields + teamId + optional fields)
export interface PipelineCreateData {
  name: string
  stages: PipelineStage[]
  teamId: string
  description?: string
  type?: PipelineType
  isDefault?: boolean
  isActive?: boolean
  dealRottenDays?: number
}

// Update data (all fields optional)
export interface PipelineUpdateData {
  name?: string
  description?: string | null
  type?: PipelineType | null
  isDefault?: boolean | null
  isActive?: boolean | null
  stages?: PipelineStage[]
  dealRottenDays?: number | null
}
