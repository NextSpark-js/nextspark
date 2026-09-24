/**
 * Product Service Types
 *
 * Type definitions for the ProductService.
 * Defines types for product catalog management including pricing,
 * inventory units, and product classification.
 *
 * @module ProductTypes
 */

// Type literals for select fields
export type ProductType = 'product' | 'service' | 'subscription' | 'bundle' | 'addon'

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

export type ProductUnit =
  | 'piece'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'year'
  | 'kg'
  | 'lb'
  | 'meter'
  | 'foot'
  | 'license'
  | 'user'

// Main entity interface
export interface Product {
  id: string
  teamId: string
  code: string
  name: string
  category?: string | null
  type?: ProductType | null
  description?: string | null
  price: number
  cost?: number | null
  currency?: Currency | null
  unit?: ProductUnit | null
  isActive?: boolean | null
  minimumQuantity?: number | null
  image?: string | null
  brochureUrl?: string | null
  commissionRate?: number | null
  createdAt: string
  updatedAt: string
}

// List options
export interface ProductListOptions {
  limit?: number
  offset?: number
  teamId?: string
  category?: string
  type?: ProductType
  currency?: Currency
  unit?: ProductUnit
  isActive?: boolean
  orderBy?:
    | 'code'
    | 'name'
    | 'category'
    | 'price'
    | 'cost'
    | 'minimumQuantity'
    | 'createdAt'
    | 'updatedAt'
  orderDir?: 'asc' | 'desc'
}

// List result
export interface ProductListResult {
  products: Product[]
  total: number
}

// Create data (required fields + teamId + optional fields)
export interface ProductCreateData {
  code: string
  name: string
  price: number
  teamId: string
  category?: string
  type?: ProductType
  description?: string
  cost?: number
  currency?: Currency
  unit?: ProductUnit
  isActive?: boolean
  minimumQuantity?: number
  image?: string
  brochureUrl?: string
  commissionRate?: number
}

// Update data (all fields optional)
export interface ProductUpdateData {
  code?: string
  name?: string
  category?: string | null
  type?: ProductType | null
  description?: string | null
  price?: number
  cost?: number | null
  currency?: Currency | null
  unit?: ProductUnit | null
  isActive?: boolean | null
  minimumQuantity?: number | null
  image?: string | null
  brochureUrl?: string | null
  commissionRate?: number | null
}
