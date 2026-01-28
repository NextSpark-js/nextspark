/**
 * Mock for @/entities/customers/api module
 */

export const mockCustomersApi = {
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  list: jest.fn(),
  get: jest.fn(),
}

export const customersApi = mockCustomersApi
