/**
 * API Presets for Dynamic Entity Routes
 *
 * These presets demonstrate the generic entity API pattern.
 * Replace {entity} with any registered entity (tasks, products, orders, etc.)
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  endpoint: '/api/v1/{entity}',
  summary: 'Generic CRUD operations for any registered entity',
  presets: [
    // ==================== LIST OPERATIONS ====================
    {
      id: 'list-basic',
      title: 'List Entities (Basic)',
      description: 'Fetch entities with default pagination',
      method: 'GET',
      queryParams: {
        limit: '20',
        offset: '0'
      },
      tags: ['read', 'list']
    },
    {
      id: 'list-with-search',
      title: 'List with Search',
      description: 'Search entities by searchable fields',
      method: 'GET',
      queryParams: {
        search: 'example',
        limit: '20'
      },
      tags: ['read', 'list', 'search']
    },
    {
      id: 'list-with-sort',
      title: 'List with Sorting',
      description: 'Sort entities by a specific field',
      method: 'GET',
      queryParams: {
        sortBy: 'createdAt',
        sortOrder: 'desc',
        limit: '20'
      },
      tags: ['read', 'list', 'sort']
    },
    {
      id: 'list-with-filter',
      title: 'List with Filter',
      description: 'Filter entities by field value (e.g., status)',
      method: 'GET',
      queryParams: {
        status: 'active',
        limit: '20'
      },
      tags: ['read', 'list', 'filter']
    },
    {
      id: 'list-paginated',
      title: 'List with Pagination',
      description: 'Get second page of results',
      method: 'GET',
      queryParams: {
        limit: '10',
        offset: '10'
      },
      tags: ['read', 'list', 'pagination']
    },

    // ==================== CREATE OPERATIONS ====================
    {
      id: 'create-basic',
      title: 'Create Entity',
      description: 'Create a new entity record',
      method: 'POST',
      payload: {
        title: 'New Item',
        status: 'draft'
      },
      tags: ['write', 'create']
    },
    {
      id: 'create-with-fields',
      title: 'Create with All Fields',
      description: 'Create entity with multiple fields',
      method: 'POST',
      payload: {
        title: 'Complete Item',
        description: 'Full description here',
        status: 'active',
        priority: 'high'
      },
      tags: ['write', 'create']
    },

    // ==================== READ SINGLE ====================
    {
      id: 'get-by-id',
      title: 'Get Entity by ID',
      description: 'Fetch a single entity by its ID',
      method: 'GET',
      path: '/{id}',
      tags: ['read', 'detail']
    },

    // ==================== UPDATE OPERATIONS ====================
    {
      id: 'update-status',
      title: 'Update Status',
      description: 'Update entity status field',
      method: 'PATCH',
      path: '/{id}',
      payload: {
        status: 'completed'
      },
      tags: ['write', 'update']
    },
    {
      id: 'update-multiple-fields',
      title: 'Update Multiple Fields',
      description: 'Partial update with multiple fields',
      method: 'PATCH',
      path: '/{id}',
      payload: {
        title: 'Updated Title',
        description: 'Updated description',
        priority: 'low'
      },
      tags: ['write', 'update']
    },

    // ==================== DELETE OPERATIONS ====================
    {
      id: 'delete-by-id',
      title: 'Delete Entity',
      description: 'Delete an entity by ID',
      method: 'DELETE',
      path: '/{id}',
      tags: ['write', 'delete']
    },

    // ==================== CHILD ENTITY OPERATIONS ====================
    {
      id: 'list-children',
      title: 'List Child Entities',
      description: 'Get all child entities for a parent',
      method: 'GET',
      path: '/{id}/child/{childType}',
      tags: ['read', 'list', 'children']
    },
    {
      id: 'create-child',
      title: 'Create Child Entity',
      description: 'Add a new child record to parent',
      method: 'POST',
      path: '/{id}/child/{childType}',
      payload: {
        name: 'New Child Item',
        value: 100
      },
      tags: ['write', 'create', 'children']
    },
    {
      id: 'get-child',
      title: 'Get Child Entity',
      description: 'Fetch a specific child entity',
      method: 'GET',
      path: '/{id}/child/{childType}/{childId}',
      tags: ['read', 'detail', 'children']
    },
    {
      id: 'update-child',
      title: 'Update Child Entity',
      description: 'Update a child entity',
      method: 'PATCH',
      path: '/{id}/child/{childType}/{childId}',
      payload: {
        name: 'Updated Child',
        value: 200
      },
      tags: ['write', 'update', 'children']
    },
    {
      id: 'delete-child',
      title: 'Delete Child Entity',
      description: 'Delete a child entity',
      method: 'DELETE',
      path: '/{id}/child/{childType}/{childId}',
      tags: ['write', 'delete', 'children']
    }
  ]
})
