/**
 * API Presets for Teams
 *
 * These presets appear in the DevTools API Explorer's "Presets" tab.
 */

import { defineApiEndpoint } from '@nextsparkjs/core/types/api-presets'

export default defineApiEndpoint({
  endpoint: '/api/v1/teams',
  summary: 'Manage teams, members, subscriptions, and multi-tenancy',
  presets: [
    // ==================== TEAM CRUD ====================
    {
      id: 'list-all',
      title: 'List My Teams',
      description: 'Fetch all teams the current user belongs to',
      method: 'GET',
      queryParams: {
        limit: '10',
        offset: '0'
      },
      tags: ['read', 'list']
    },
    {
      id: 'create-team',
      title: 'Create New Team',
      description: 'Create a new team (user becomes owner)',
      method: 'POST',
      payload: {
        name: 'New Team',
        slug: 'new-team'
      },
      tags: ['write', 'create']
    },
    {
      id: 'get-team',
      title: 'Get Team Details',
      description: 'Get details of a specific team',
      method: 'GET',
      path: '/{{CURRENT_TEAM_ID}}',
      tags: ['read', 'detail']
    },
    {
      id: 'update-team',
      title: 'Update Team',
      description: 'Update team name and settings',
      method: 'PATCH',
      path: '/{{CURRENT_TEAM_ID}}',
      payload: {
        name: 'Updated Team Name',
        description: 'New team description'
      },
      tags: ['write', 'update']
    },

    // ==================== MEMBERS ====================
    {
      id: 'list-members',
      title: 'List Team Members',
      description: 'Get all members of the current team',
      method: 'GET',
      path: '/{{CURRENT_TEAM_ID}}/members',
      queryParams: {
        page: '1',
        limit: '20'
      },
      tags: ['read', 'list', 'members']
    },
    {
      id: 'list-members-admins',
      title: 'List Admins Only',
      description: 'Filter members by admin role',
      method: 'GET',
      path: '/{{CURRENT_TEAM_ID}}/members',
      queryParams: {
        role: 'admin'
      },
      tags: ['read', 'list', 'members', 'filter']
    },
    {
      id: 'search-members',
      title: 'Search Members',
      description: 'Search members by name or email',
      method: 'GET',
      path: '/{{CURRENT_TEAM_ID}}/members',
      queryParams: {
        search: 'john'
      },
      tags: ['read', 'list', 'members', 'search']
    },
    {
      id: 'invite-member',
      title: 'Invite New Member',
      description: 'Send invitation to join team',
      method: 'POST',
      path: '/{{CURRENT_TEAM_ID}}/members',
      payload: {
        email: 'newuser@example.com',
        role: 'member'
      },
      tags: ['write', 'create', 'members']
    },
    {
      id: 'invite-admin',
      title: 'Invite as Admin',
      description: 'Invite user with admin role',
      method: 'POST',
      path: '/{{CURRENT_TEAM_ID}}/members',
      payload: {
        email: 'admin@example.com',
        role: 'admin'
      },
      tags: ['write', 'create', 'members']
    },

    // ==================== INVITATIONS ====================
    {
      id: 'list-invitations',
      title: 'List Pending Invitations',
      description: 'Get all pending team invitations',
      method: 'GET',
      path: '/{{CURRENT_TEAM_ID}}/invitations',
      tags: ['read', 'list', 'invitations']
    },

    // ==================== SUBSCRIPTION ====================
    {
      id: 'get-subscription',
      title: 'Get Team Subscription',
      description: 'View current subscription details',
      method: 'GET',
      path: '/{{CURRENT_TEAM_ID}}/subscription',
      tags: ['read', 'billing']
    },

    // ==================== USAGE / QUOTAS ====================
    {
      id: 'check-members-usage',
      title: 'Check Members Quota',
      description: 'Check team member limit usage',
      method: 'GET',
      path: '/{{CURRENT_TEAM_ID}}/usage/team_members',
      tags: ['read', 'usage', 'quota']
    },
    {
      id: 'check-storage-usage',
      title: 'Check Storage Quota',
      description: 'Check storage limit usage',
      method: 'GET',
      path: '/{{CURRENT_TEAM_ID}}/usage/storage_gb',
      tags: ['read', 'usage', 'quota']
    },

    // ==================== INVOICES ====================
    {
      id: 'list-invoices',
      title: 'List Team Invoices',
      description: 'Get billing invoices for the team',
      method: 'GET',
      path: '/{{CURRENT_TEAM_ID}}/invoices',
      tags: ['read', 'billing', 'invoices']
    },

    // ==================== SWITCH TEAM ====================
    {
      id: 'switch-team',
      title: 'Switch Active Team',
      description: 'Change the active team context',
      method: 'POST',
      path: '/switch',
      payload: {
        teamId: '{{CURRENT_TEAM_ID}}'
      },
      tags: ['write', 'context']
    }
  ]
})
