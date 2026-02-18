import type { Tour } from '../types/walkme.types'

/**
 * Basic single-page tour example.
 * Shows a welcome modal, then highlights sidebar navigation and create button.
 */
export const basicTour: Tour = {
  id: 'getting-started',
  name: 'Getting Started',
  description: 'Learn the basics of the application',
  trigger: { type: 'onFirstVisit', delay: 1000 },
  steps: [
    {
      id: 'welcome',
      type: 'modal',
      title: 'Welcome!',
      content: 'Let us show you around the application. This quick tour will help you get started.',
      actions: ['next', 'skip'],
    },
    {
      id: 'sidebar',
      type: 'tooltip',
      target: '[data-cy="sidebar-nav"]',
      title: 'Navigation',
      content: 'Use the sidebar to navigate between different sections of the app.',
      position: 'right',
      actions: ['next', 'prev', 'skip'],
    },
    {
      id: 'create-btn',
      type: 'spotlight',
      target: '[data-cy="create-button"]',
      title: 'Create New Item',
      content: 'Click here to create your first item. Give it a try!',
      actions: ['complete', 'prev'],
    },
  ],
}
