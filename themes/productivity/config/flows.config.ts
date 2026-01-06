/**
 * Productivity Theme - Flows Configuration
 *
 * Defines user journeys/flows that span multiple features.
 * Each flow key becomes a tag: @flow-{key}
 *
 * Flows are enriched at build-time with:
 * - Feature metadata (from features.config.ts)
 * - Test coverage (from tags-registry + test files)
 */

import { defineFlows } from '@nextsparkjs/core/lib/config/features-types'

export default defineFlows({
  // ===========================================================================
  // ACQUISITION FLOWS
  // User acquisition and onboarding journeys
  // ===========================================================================

  onboarding: {
    name: 'User Onboarding',
    description: 'Complete journey from signup to first board creation',
    category: 'acquisition',
    icon: 'rocket',
    criticalPath: true,

    steps: [
      {
        feature: 'auth',
        action: 'signup',
        description: 'User creates account with email/password or OAuth',
      },
      {
        feature: 'auth',
        action: 'verify-email',
        description: 'User verifies email address',
      },
      {
        feature: 'teams',
        action: 'create-team',
        description: 'User creates their first team/workspace',
      },
      {
        feature: 'boards',
        action: 'create-first-board',
        description: 'User creates their first board',
      },
    ],

    features: ['auth', 'teams', 'boards'],
  },

  'invite-member': {
    name: 'Invite Team Member',
    description: 'Invite a collaborator to the team/workspace',
    category: 'acquisition',
    icon: 'user-plus',
    criticalPath: false,

    steps: [
      {
        feature: 'teams',
        action: 'open-team-settings',
        description: 'Owner opens team settings',
      },
      {
        feature: 'teams',
        action: 'click-invite',
        description: 'Owner clicks invite member',
      },
      {
        feature: 'teams',
        action: 'enter-email',
        description: 'Owner enters member email',
      },
      {
        feature: 'teams',
        action: 'send-invite',
        description: 'System sends invitation email',
      },
    ],

    features: ['teams'],
  },

  // ===========================================================================
  // NAVIGATION FLOWS
  // Context switching and navigation journeys
  // ===========================================================================

  'team-switch': {
    name: 'Team Switching',
    description: 'Switch between different teams/workspaces',
    category: 'navigation',
    icon: 'repeat',
    criticalPath: true,

    steps: [
      {
        feature: 'team-switch',
        action: 'open-switcher',
        description: 'User opens the team switcher dropdown',
      },
      {
        feature: 'team-switch',
        action: 'select-team',
        description: 'User selects a different team',
      },
      {
        feature: 'team-switch',
        action: 'load-context',
        description: 'System loads new team context and redirects',
      },
    ],

    features: ['team-switch', 'teams'],
  },

  // ===========================================================================
  // BOARD MANAGEMENT FLOWS
  // Board creation and management
  // ===========================================================================

  'create-board': {
    name: 'Create Board',
    description: 'Create a new project board',
    category: 'boards',
    icon: 'plus',
    criticalPath: true,

    steps: [
      {
        feature: 'boards',
        action: 'click-create',
        description: 'User clicks create board button',
      },
      {
        feature: 'boards',
        action: 'enter-name',
        description: 'User enters board name and description',
      },
      {
        feature: 'boards',
        action: 'save',
        description: 'User saves the new board',
      },
      {
        feature: 'kanban',
        action: 'view-board',
        description: 'User is redirected to the new board',
      },
    ],

    features: ['boards', 'kanban'],
  },

  'manage-board': {
    name: 'Manage Board',
    description: 'Configure board settings',
    category: 'boards',
    icon: 'settings',
    criticalPath: false,

    steps: [
      {
        feature: 'kanban',
        action: 'open-board',
        description: 'User opens a board',
      },
      {
        feature: 'board-settings',
        action: 'open-settings',
        description: 'User opens board settings',
      },
      {
        feature: 'board-settings',
        action: 'modify',
        description: 'User modifies board name/description',
      },
      {
        feature: 'board-settings',
        action: 'save',
        description: 'User saves changes',
      },
    ],

    features: ['boards', 'board-settings', 'kanban'],
  },

  // ===========================================================================
  // LIST MANAGEMENT FLOWS
  // List/column operations
  // ===========================================================================

  'create-list': {
    name: 'Create List',
    description: 'Add a new list/column to a board',
    category: 'lists',
    icon: 'plus',
    criticalPath: true,

    steps: [
      {
        feature: 'kanban',
        action: 'open-board',
        description: 'User opens a board',
      },
      {
        feature: 'lists',
        action: 'click-add-list',
        description: 'User clicks add list button',
      },
      {
        feature: 'lists',
        action: 'enter-name',
        description: 'User enters list name',
      },
      {
        feature: 'lists',
        action: 'save',
        description: 'User saves the new list',
      },
    ],

    features: ['kanban', 'lists'],
  },

  'reorder-lists': {
    name: 'Reorder Lists',
    description: 'Drag and drop lists to reorder',
    category: 'lists',
    icon: 'move',
    criticalPath: false,

    steps: [
      {
        feature: 'kanban',
        action: 'open-board',
        description: 'User opens a board',
      },
      {
        feature: 'drag-drop',
        action: 'grab-list',
        description: 'User grabs a list header',
      },
      {
        feature: 'drag-drop',
        action: 'drag-list',
        description: 'User drags list to new position',
      },
      {
        feature: 'list-reorder',
        action: 'drop-list',
        description: 'User drops list and order is saved',
      },
    ],

    features: ['kanban', 'drag-drop', 'list-reorder'],
  },

  // ===========================================================================
  // CARD MANAGEMENT FLOWS
  // Card/task operations
  // ===========================================================================

  'create-card': {
    name: 'Create Card',
    description: 'Add a new card/task to a list',
    category: 'cards',
    icon: 'plus',
    criticalPath: true,

    steps: [
      {
        feature: 'kanban',
        action: 'open-board',
        description: 'User opens a board',
      },
      {
        feature: 'cards',
        action: 'click-add-card',
        description: 'User clicks add card in a list',
      },
      {
        feature: 'cards',
        action: 'enter-title',
        description: 'User enters card title',
      },
      {
        feature: 'cards',
        action: 'save',
        description: 'User saves the new card',
      },
    ],

    features: ['kanban', 'cards'],
  },

  'edit-card': {
    name: 'Edit Card',
    description: 'Open and edit card details',
    category: 'cards',
    icon: 'edit',
    criticalPath: true,

    steps: [
      {
        feature: 'kanban',
        action: 'click-card',
        description: 'User clicks on a card',
      },
      {
        feature: 'card-detail',
        action: 'open-modal',
        description: 'Card detail modal opens',
      },
      {
        feature: 'card-detail',
        action: 'edit-fields',
        description: 'User edits card title, description, due date',
      },
      {
        feature: 'card-detail',
        action: 'save',
        description: 'User saves changes',
      },
    ],

    features: ['kanban', 'card-detail', 'cards'],
  },

  'move-card': {
    name: 'Move Card',
    description: 'Drag card to a different list',
    category: 'cards',
    icon: 'move',
    criticalPath: true,

    steps: [
      {
        feature: 'kanban',
        action: 'open-board',
        description: 'User views board with cards',
      },
      {
        feature: 'drag-drop',
        action: 'grab-card',
        description: 'User grabs a card',
      },
      {
        feature: 'drag-drop',
        action: 'drag-card',
        description: 'User drags card to target list',
      },
      {
        feature: 'card-move',
        action: 'drop-card',
        description: 'User drops card and position is saved',
      },
    ],

    features: ['kanban', 'drag-drop', 'card-move'],
  },

  'assign-card': {
    name: 'Assign Card',
    description: 'Assign a card to a team member',
    category: 'cards',
    icon: 'user-plus',
    criticalPath: false,

    steps: [
      {
        feature: 'card-detail',
        action: 'open-card',
        description: 'User opens card detail',
      },
      {
        feature: 'card-assign',
        action: 'click-assign',
        description: 'User clicks assign button',
      },
      {
        feature: 'card-assign',
        action: 'select-member',
        description: 'User selects team member',
      },
      {
        feature: 'card-assign',
        action: 'confirm',
        description: 'Assignment is saved',
      },
    ],

    features: ['card-detail', 'card-assign'],
  },

  // ===========================================================================
  // KANBAN WORKFLOW FLOWS
  // Complete task workflows
  // ===========================================================================

  'kanban-workflow': {
    name: 'Kanban Workflow',
    description: 'Complete task lifecycle from creation to completion',
    category: 'content',
    icon: 'workflow',
    criticalPath: true,

    steps: [
      {
        feature: 'cards',
        action: 'create',
        description: 'User creates a new card in first list',
      },
      {
        feature: 'card-detail',
        action: 'add-details',
        description: 'User adds description and due date',
      },
      {
        feature: 'card-assign',
        action: 'assign',
        description: 'User assigns card to team member',
        optional: true,
      },
      {
        feature: 'card-move',
        action: 'progress',
        description: 'Card is moved through lists as work progresses',
      },
      {
        feature: 'card-move',
        action: 'complete',
        description: 'Card is moved to done list',
      },
    ],

    features: ['cards', 'card-detail', 'card-assign', 'card-move', 'kanban'],
  },

  // ===========================================================================
  // BILLING FLOWS
  // Subscription and payment journeys
  // ===========================================================================

  'upgrade-plan': {
    name: 'Upgrade Plan',
    description: 'Upgrade subscription to a higher tier plan',
    category: 'settings',
    icon: 'trending-up',
    criticalPath: false,

    steps: [
      {
        feature: 'plans',
        action: 'view-plans',
        description: 'User views available plans',
      },
      {
        feature: 'plans',
        action: 'compare-plans',
        description: 'User compares features between plans',
      },
      {
        feature: 'plans',
        action: 'select-plan',
        description: 'User selects a new plan',
      },
      {
        feature: 'billing',
        action: 'enter-payment',
        description: 'User enters or confirms payment method',
      },
      {
        feature: 'billing',
        action: 'confirm-upgrade',
        description: 'User confirms the upgrade',
      },
    ],

    features: ['plans', 'billing'],
  },
})
