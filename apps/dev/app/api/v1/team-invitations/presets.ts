/**
 * API Presets for Team Invitations
 *
 * These presets appear in the DevTools API Explorer's "Presets" tab.
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  endpoint: '/api/v1/team-invitations',
  summary: 'Manage team invitations for new members',
  presets: [
    {
      id: 'list-pending',
      title: 'List Pending Invitations',
      description: 'Fetch all pending invitations for the team',
      method: 'GET',
      tags: ['read', 'list']
    },
    {
      id: 'invite-member',
      title: 'Invite as Member',
      description: 'Send invitation with member role',
      method: 'POST',
      payload: {
        email: 'newuser@example.com',
        role: 'member'
      },
      tags: ['write', 'create', 'invite']
    },
    {
      id: 'invite-admin',
      title: 'Invite as Admin',
      description: 'Send invitation with admin role',
      method: 'POST',
      payload: {
        email: 'admin@example.com',
        role: 'admin'
      },
      tags: ['write', 'create', 'invite', 'admin']
    }
  ]
})
