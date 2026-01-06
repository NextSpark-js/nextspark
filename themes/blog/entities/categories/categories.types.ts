/**
 * Categories Service Types
 *
 * Type definitions for the CategoriesService.
 * Categories is a private entity - users only see categories in their team.
 *
 * @module CategoriesTypes
 */

/**
 * Category entity
 */
export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  createdAt: string
  updatedAt: string
}

/**
 * Options for listing categories
 */
export interface CategoryListOptions {
  limit?: number
  offset?: number
  teamId?: string
  orderBy?: 'name' | 'slug' | 'createdAt'
  orderDir?: 'asc' | 'desc'
}

/**
 * Result of listing categories with pagination
 */
export interface CategoryListResult {
  categories: Category[]
  total: number
}

/**
 * Data required to create a new category
 */
export interface CategoryCreateData {
  name: string
  slug: string
  teamId: string
  description?: string
}

/**
 * Data for updating an existing category
 */
export interface CategoryUpdateData {
  name?: string
  slug?: string
  description?: string
}
