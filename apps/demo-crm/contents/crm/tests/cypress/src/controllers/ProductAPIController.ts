/**
 * ProductAPIController - TypeScript controller for Products API
 *
 * Handles CRUD operations for /api/v1/products endpoints
 */

import { BaseAPIController, APIRequestOptions, APIResponse } from './BaseAPIController'

export interface ProductData {
  name?: string
  code?: string
  description?: string
  price?: number
  currency?: string
  category?: string
  isActive?: boolean
  sku?: string
  unit?: string
}

export interface ProductGetAllOptions extends APIRequestOptions {
  category?: string
  isActive?: boolean
  minPrice?: number
  maxPrice?: number
}

export class ProductAPIController extends BaseAPIController {
  protected entitySlug = 'products'

  /**
   * GET all products with filtering options
   */
  getAll(options: ProductGetAllOptions = {}): Cypress.Chainable<APIResponse> {
    return super.getAll(options)
  }

  /**
   * Activate product
   */
  activate(id: string, options: APIRequestOptions = {}): Cypress.Chainable<APIResponse> {
    return this.update(id, { isActive: true }, options)
  }

  /**
   * Deactivate product
   */
  deactivate(id: string, options: APIRequestOptions = {}): Cypress.Chainable<APIResponse> {
    return this.update(id, { isActive: false }, options)
  }

  /**
   * Generate random product data for testing
   */
  generateRandomData(overrides: Partial<ProductData> = {}): ProductData {
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)

    const categories = ['Software', 'Hardware', 'Services', 'Consulting', 'Support', 'Training']
    const currencies = ['USD', 'EUR', 'GBP']
    const units = ['unit', 'hour', 'month', 'year', 'license']

    const productNames = [
      'Enterprise License',
      'Professional Package',
      'Basic Plan',
      'Premium Support',
      'Custom Development',
      'Training Session'
    ]

    return {
      name: `${productNames[Math.floor(Math.random() * productNames.length)]} ${randomId}`,
      code: `PROD-${timestamp}-${randomId}`.toUpperCase(),
      description: `Test product created at ${new Date(timestamp).toISOString()}`,
      price: Math.floor(Math.random() * 10000) + 100,
      currency: currencies[Math.floor(Math.random() * currencies.length)],
      category: categories[Math.floor(Math.random() * categories.length)],
      isActive: true,
      sku: `SKU-${randomId}`.toUpperCase(),
      unit: units[Math.floor(Math.random() * units.length)],
      ...overrides
    }
  }

  /**
   * Validate product object structure
   */
  validateObject(product: Record<string, unknown>, allowMetas = false): void {
    this.validateSystemFields(product)

    expect(product).to.have.property('name')
    expect(product.name).to.be.a('string')

    this.validateOptionalStringFields(product, [
      'code', 'description', 'currency', 'category', 'sku', 'unit'
    ])

    if (product.price !== null && product.price !== undefined) {
      expect(Number(product.price)).to.be.a('number')
    }

    if (product.isActive !== null && product.isActive !== undefined) {
      expect(product.isActive).to.be.a('boolean')
    }

    if (allowMetas && Object.prototype.hasOwnProperty.call(product, 'metas')) {
      expect(product.metas).to.be.an('object')
    }
  }
}

export default ProductAPIController
