/**
 * Customers Service Types
 *
 * Type definitions for the CustomersService.
 * Customers is a private entity (access.shared: true) - all authenticated
 * users can access all records within their team context.
 *
 * @module CustomersTypes
 */

/**
 * Day of week values for visit/contact days
 */
export type DayOfWeek = 'lun' | 'mar' | 'mie' | 'jue' | 'vie'

/**
 * Customer entity
 */
export interface Customer {
  id: string
  name: string
  account: number
  office: string
  phone?: string
  salesRep?: string
  visitDays?: DayOfWeek[]
  contactDays?: DayOfWeek[]
  createdAt?: string
  updatedAt?: string
}

/**
 * Options for listing customers
 */
export interface CustomerListOptions {
  limit?: number
  offset?: number
  orderBy?: 'name' | 'account' | 'office' | 'salesRep' | 'createdAt'
  orderDir?: 'asc' | 'desc'
}

/**
 * Result of listing customers with pagination
 */
export interface CustomerListResult {
  customers: Customer[]
  total: number
}

/**
 * Search options
 */
export interface CustomerSearchOptions {
  query: string
  limit?: number
}

/**
 * Data required to create a new customer
 */
export interface CustomerCreateData {
  name: string
  account: number
  office: string
  teamId: string
  phone?: string
  salesRep?: string
  visitDays?: DayOfWeek[]
  contactDays?: DayOfWeek[]
}

/**
 * Data for updating an existing customer
 */
export interface CustomerUpdateData {
  name?: string
  account?: number
  office?: string
  phone?: string
  salesRep?: string
  visitDays?: DayOfWeek[]
  contactDays?: DayOfWeek[]
}
