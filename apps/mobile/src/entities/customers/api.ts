/**
 * Customers API Client
 *
 * Auto-generated entity API using createEntityApi factory.
 */

import { createEntityApi } from '../../api/entities'
import type { Customer, CreateCustomerInput, UpdateCustomerInput } from './types'

export const customersApi = createEntityApi<Customer, CreateCustomerInput, UpdateCustomerInput>('customers')
