/**
 * Customer Entity Types
 */

// Day options for visit/contact days
export type DayOption = 'lun' | 'mar' | 'mie' | 'jue' | 'vie'

// Customer entity
export interface Customer {
  id: string
  name: string
  account: number
  office: string
  phone?: string | null
  salesRep?: string | null
  visitDays?: DayOption[] | null
  contactDays?: DayOption[] | null
  teamId: string
  createdAt: string
  updatedAt: string
}

// Create customer payload
export interface CreateCustomerInput {
  name: string
  account: number
  office: string
  phone?: string
  salesRep?: string
  visitDays?: DayOption[]
  contactDays?: DayOption[]
}

// Update customer payload
export interface UpdateCustomerInput {
  name?: string
  account?: number
  office?: string
  phone?: string | null
  salesRep?: string | null
  visitDays?: DayOption[] | null
  contactDays?: DayOption[] | null
}
