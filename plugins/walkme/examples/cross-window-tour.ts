import type { Tour } from '../types/walkme.types'

/**
 * Cross-window (multi-page) tour example.
 * Navigates between dashboard and settings pages.
 */
export const crossWindowTour: Tour = {
  id: 'explore-app',
  name: 'Explore the App',
  description: 'Tour across multiple pages',
  trigger: { type: 'manual' },
  conditions: {
    completedTours: ['getting-started'],
  },
  steps: [
    {
      id: 'dashboard-overview',
      type: 'modal',
      title: 'Explore the App',
      content: "Now that you know the basics, let's explore the key areas of the app.",
      route: '/dashboard',
      actions: ['next', 'skip'],
    },
    {
      id: 'dashboard-stats',
      type: 'tooltip',
      target: '[data-cy="dashboard-stats"]',
      title: 'Your Stats',
      content: 'Here you can see your key metrics at a glance.',
      position: 'bottom',
      route: '/dashboard',
      actions: ['next', 'prev', 'skip'],
    },
    {
      id: 'settings-nav',
      type: 'tooltip',
      target: '[data-cy="nav-settings"]',
      title: 'Settings',
      content: "Let's head to settings to configure your profile.",
      position: 'right',
      route: '/dashboard',
      actions: ['next', 'prev', 'skip'],
    },
    {
      id: 'profile-settings',
      type: 'spotlight',
      target: '[data-cy="profile-form"]',
      title: 'Your Profile',
      content: 'Complete your profile information to get the most out of the app.',
      route: '/settings/profile',
      actions: ['complete', 'prev'],
    },
  ],
}
