/**
 * API Presets for Contacts Entity
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  summary: 'Manage customer contacts with company associations',
  presets: [
    {
      id: 'list-all',
      title: 'List All Contacts',
      description: 'Get all contacts with pagination',
      method: 'GET',
      params: {
        limit: 20
      },
      tags: ['read', 'list']
    },
    {
      id: 'list-by-company',
      title: 'List by Company',
      description: 'Get contacts for a specific company',
      method: 'GET',
      params: {
        companyId: '{{companyId}}'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'list-primary',
      title: 'List Primary Contacts',
      description: 'Get all primary contacts',
      method: 'GET',
      params: {
        isPrimary: 'true'
      },
      tags: ['read', 'filter']
    },
    {
      id: 'search-by-name',
      title: 'Search by Name',
      description: 'Search contacts by name',
      method: 'GET',
      params: {
        search: '{{name}}'
      },
      tags: ['read', 'search']
    },
    {
      id: 'search-by-email',
      title: 'Search by Email',
      description: 'Search contacts by email',
      method: 'GET',
      params: {
        search: '{{email}}'
      },
      tags: ['read', 'search']
    },
    {
      id: 'create-contact',
      title: 'Create New Contact',
      description: 'Create a contact with sample data',
      method: 'POST',
      payload: {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@sample.com',
        position: 'Manager',
        preferredChannel: 'email'
      },
      tags: ['write', 'create']
    },
    {
      id: 'update-contact',
      title: 'Update Contact',
      description: 'Update contact information',
      method: 'PATCH',
      pathParams: {
        id: '{{id}}'
      },
      payload: {
        phone: '{{phone}}'
      },
      tags: ['write', 'update']
    },
    {
      id: 'delete-contact',
      title: 'Delete Contact',
      description: 'Delete a contact record',
      method: 'DELETE',
      pathParams: {
        id: '{{id}}'
      },
      tags: ['write', 'delete']
    }
  ]
})
