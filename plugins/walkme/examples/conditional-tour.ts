import type { Tour } from '../types/walkme.types'

/**
 * Conditional tour example.
 * Only shown to users with 'admin' role after they've completed the basic tour.
 */
export const adminFeaturesTour: Tour = {
  id: 'admin-features',
  name: 'Admin Features',
  description: 'Tour of admin-only functionality',
  priority: 10,
  trigger: {
    type: 'onRouteEnter',
    route: '/admin/*',
    delay: 500,
  },
  conditions: {
    userRole: ['admin', 'superadmin'],
    completedTours: ['getting-started'],
    featureFlags: ['admin-panel-v2'],
  },
  steps: [
    {
      id: 'admin-welcome',
      type: 'modal',
      title: 'Admin Dashboard',
      content: 'Welcome to the admin area. Here are the key features available to you.',
      actions: ['next', 'skip'],
    },
    {
      id: 'user-management',
      type: 'tooltip',
      target: '[data-cy="admin-users"]',
      title: 'User Management',
      content: 'Manage all user accounts, roles, and permissions from here.',
      position: 'right',
      actions: ['next', 'prev', 'skip'],
    },
    {
      id: 'analytics',
      type: 'spotlight',
      target: '[data-cy="admin-analytics"]',
      title: 'Analytics',
      content: 'View detailed analytics and reports about app usage.',
      actions: ['next', 'prev', 'skip'],
    },
    {
      id: 'system-config',
      type: 'beacon',
      target: '[data-cy="admin-config"]',
      title: 'System Configuration',
      content: 'Advanced system settings are available here.',
      actions: ['complete'],
    },
  ],
}
