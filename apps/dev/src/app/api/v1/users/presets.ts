/**
 * API Presets for Users
 *
 * These presets appear in the DevTools API Explorer's "Presets" tab.
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  endpoint: '/api/v1/users',
  summary: 'Manage user profiles and team members',
  presets: [
    {
      id: 'get-me',
      title: 'Get Current User',
      description: 'Fetch the currently authenticated user profile',
      method: 'GET',
      pathParams: {
        id: 'me'
      },
      tags: ['read', 'profile']
    },
    {
      id: 'list-team-members',
      title: 'List Team Members',
      description: 'Fetch all users in the current team',
      method: 'GET',
      params: {
        limit: 20,
        offset: 0
      },
      tags: ['read', 'list']
    },
    {
      id: 'update-profile',
      title: 'Update My Profile',
      description: 'Update current user name',
      method: 'PATCH',
      pathParams: {
        id: 'me'
      },
      payload: {
        name: 'Updated Name'
      },
      tags: ['write', 'profile']
    },
    {
      id: 'search-users',
      title: 'Search Team Members',
      description: 'Search users by name or email',
      method: 'GET',
      params: {
        search: 'john',
        limit: 10
      },
      tags: ['read', 'search']
    }
  ]
})
