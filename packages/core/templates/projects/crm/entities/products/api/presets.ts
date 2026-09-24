/**
 * API Presets for Products Entity
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  summary: 'Manage products and services catalog',
  presets: [
    {
      id: 'list-all',
      title: 'List All Products',
      description: 'Get all products with pagination',
      method: 'GET',
      params: {
        limit: 20
      },
      tags: ['read', 'list']
    },
    {
      id: 'list-active',
      title: 'List Active Products',
      description: 'Get all active products',
      method: 'GET',
      params: {
        isActive: 'true'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-by-type',
      title: 'List by Type',
      description: 'Get products of a specific type',
      method: 'GET',
      params: {
        type: '{{type}}'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-subscriptions',
      title: 'List Subscriptions',
      description: 'Get all subscription products',
      method: 'GET',
      params: {
        type: 'subscription'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-services',
      title: 'List Services',
      description: 'Get all service products',
      method: 'GET',
      params: {
        type: 'service'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'search-by-name',
      title: 'Search by Name',
      description: 'Search products by name',
      method: 'GET',
      params: {
        search: '{{name}}'
      },
      tags: ['read', 'search']
    },
    {
      id: 'search-by-code',
      title: 'Search by Code',
      description: 'Search products by code/SKU',
      method: 'GET',
      params: {
        search: '{{code}}'
      },
      tags: ['read', 'search']
    },
    {
      id: 'create-product',
      title: 'Create Product',
      description: 'Create a new product',
      method: 'POST',
      payload: {
        code: 'PRD-NEW',
        name: 'New Product',
        type: 'product',
        price: 100,
        currency: 'USD',
        isActive: true
      },
      tags: ['write', 'create']
    },
    {
      id: 'update-price',
      title: 'Update Price',
      description: 'Update product pricing',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        price: '{{newPrice}}'
      },
      tags: ['write', 'update']
    },
    {
      id: 'deactivate',
      title: 'Deactivate Product',
      description: 'Deactivate a product',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        isActive: false
      },
      tags: ['write', 'update']
    },
    {
      id: 'delete-product',
      title: 'Delete Product',
      description: 'Delete a product record',
      method: 'DELETE',
      pathParams: {
        id: '{{id}}'
      },
      tags: ['write', 'delete']
    }
  ]
})
