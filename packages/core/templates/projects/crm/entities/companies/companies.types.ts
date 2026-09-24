/**
 * Company Service Types
 *
 * Type definitions for the CompanyService.
 * Defines types for company management including business details,
 * company classification, and account ownership.
 *
 * @module CompanyTypes
 */

// Type literals for select fields
export type CompanyType =
  | 'prospect'
  | 'customer'
  | 'partner'
  | 'competitor'
  | 'vendor'
  | 'other'

export type CompanySize = '1-10' | '11-50' | '51-200' | '201-500' | '500+'

export type CompanyRating = 'hot' | 'warm' | 'cold'

// Main entity interface
export interface Company {
  id: string
  teamId: string
  name: string
  legalName?: string | null
  taxId?: string | null
  website?: string | null
  email?: string | null
  phone?: string | null
  industry?: string | null
  type?: CompanyType | null
  size?: CompanySize | null
  annualRevenue?: number | null
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  postalCode?: string | null
  logo?: string | null
  rating?: CompanyRating | null
  assignedTo?: string | null
  createdAt: string
  updatedAt: string
}

// List options
export interface CompanyListOptions {
  limit?: number
  offset?: number
  teamId?: string
  type?: CompanyType
  size?: CompanySize
  rating?: CompanyRating
  industry?: string
  country?: string
  assignedTo?: string
  orderBy?:
    | 'name'
    | 'legalName'
    | 'email'
    | 'phone'
    | 'industry'
    | 'annualRevenue'
    | 'city'
    | 'state'
    | 'country'
    | 'createdAt'
    | 'updatedAt'
  orderDir?: 'asc' | 'desc'
}

// List result
export interface CompanyListResult {
  companies: Company[]
  total: number
}

// Create data (required fields + teamId + optional fields)
export interface CompanyCreateData {
  name: string
  teamId: string
  legalName?: string
  taxId?: string
  website?: string
  email?: string
  phone?: string
  industry?: string
  type?: CompanyType
  size?: CompanySize
  annualRevenue?: number
  address?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
  logo?: string
  rating?: CompanyRating
  assignedTo?: string
}

// Update data (all fields optional)
export interface CompanyUpdateData {
  name?: string
  legalName?: string | null
  taxId?: string | null
  website?: string | null
  email?: string | null
  phone?: string | null
  industry?: string | null
  type?: CompanyType | null
  size?: CompanySize | null
  annualRevenue?: number | null
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  postalCode?: string | null
  logo?: string | null
  rating?: CompanyRating | null
  assignedTo?: string | null
}
