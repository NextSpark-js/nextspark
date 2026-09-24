/**
 * Blog Theme - Flows Configuration
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
    name: 'Author Onboarding',
    description: 'Complete journey from signup to first published post',
    category: 'acquisition',
    icon: 'rocket',
    criticalPath: true,

    steps: [
      {
        feature: 'auth',
        action: 'signup',
        description: 'Author creates account with email/password',
      },
      {
        feature: 'auth',
        action: 'verify-email',
        description: 'Author verifies email address',
      },
      {
        feature: 'users',
        action: 'setup-profile',
        description: 'Author sets up their profile (bio, avatar)',
        optional: true,
      },
      {
        feature: 'posts',
        action: 'create-first-post',
        description: 'Author creates their first blog post',
      },
    ],

    features: ['auth', 'users', 'posts'],
  },

  // ===========================================================================
  // CONTENT CREATION FLOWS
  // Post creation and publishing journeys
  // ===========================================================================

  'create-post': {
    name: 'Create Post',
    description: 'Complete journey to create and publish a blog post',
    category: 'content',
    icon: 'edit',
    criticalPath: true,

    steps: [
      {
        feature: 'posts',
        action: 'create-draft',
        description: 'Author creates a new draft post',
      },
      {
        feature: 'post-editor',
        action: 'write-content',
        description: 'Author writes post content using the editor',
      },
      {
        feature: 'post-editor',
        action: 'add-featured-image',
        description: 'Author adds featured image',
        optional: true,
      },
      {
        feature: 'categories',
        action: 'assign-category',
        description: 'Author assigns categories to the post',
        optional: true,
      },
      {
        feature: 'publishing',
        action: 'publish',
        description: 'Author publishes the post',
      },
    ],

    features: ['posts', 'post-editor', 'categories', 'publishing'],
  },

  'edit-post': {
    name: 'Edit Post',
    description: 'Edit and update an existing post',
    category: 'content',
    icon: 'pencil',
    criticalPath: false,

    steps: [
      {
        feature: 'posts',
        action: 'select-post',
        description: 'Author selects a post to edit',
      },
      {
        feature: 'post-editor',
        action: 'modify-content',
        description: 'Author modifies post content',
      },
      {
        feature: 'posts',
        action: 'save-changes',
        description: 'Author saves the updated post',
      },
    ],

    features: ['posts', 'post-editor'],
  },

  // ===========================================================================
  // PUBLISHING FLOWS
  // Content publishing workflows
  // ===========================================================================

  'publish-workflow': {
    name: 'Publishing Workflow',
    description: 'Manage post status from draft to published',
    category: 'content',
    icon: 'send',
    criticalPath: true,

    steps: [
      {
        feature: 'posts',
        action: 'review-draft',
        description: 'Author reviews draft post',
      },
      {
        feature: 'publishing',
        action: 'set-publish-date',
        description: 'Author sets publish date (optional)',
        optional: true,
      },
      {
        feature: 'publishing',
        action: 'publish',
        description: 'Author publishes the post',
      },
    ],

    features: ['posts', 'publishing'],
  },

  unpublish: {
    name: 'Unpublish Post',
    description: 'Take a published post offline',
    category: 'content',
    icon: 'eye-off',
    criticalPath: false,

    steps: [
      {
        feature: 'posts',
        action: 'select-published-post',
        description: 'Author selects a published post',
      },
      {
        feature: 'publishing',
        action: 'unpublish',
        description: 'Author unpublishes the post (reverts to draft)',
      },
    ],

    features: ['posts', 'publishing'],
  },

  // ===========================================================================
  // DATA MANAGEMENT FLOWS
  // Import/export workflows
  // ===========================================================================

  'export-content': {
    name: 'Export Content',
    description: 'Export blog content for backup or migration',
    category: 'settings',
    icon: 'download',
    criticalPath: false,

    steps: [
      {
        feature: 'post-export',
        action: 'select-content',
        description: 'Author selects content to export',
      },
      {
        feature: 'post-export',
        action: 'export',
        description: 'Author downloads the exported JSON file',
      },
    ],

    features: ['post-export'],
  },

  'import-content': {
    name: 'Import Content',
    description: 'Import blog content from backup file',
    category: 'settings',
    icon: 'upload',
    criticalPath: false,

    steps: [
      {
        feature: 'post-import',
        action: 'select-file',
        description: 'Author selects JSON file to import',
      },
      {
        feature: 'post-import',
        action: 'review-content',
        description: 'Author reviews content to be imported',
      },
      {
        feature: 'post-import',
        action: 'confirm-import',
        description: 'Author confirms and executes import',
      },
    ],

    features: ['post-import'],
  },

  // ===========================================================================
  // PUBLIC READING FLOWS
  // Reader-facing journeys
  // ===========================================================================

  'read-post': {
    name: 'Read Post',
    description: 'Public reader views a blog post',
    category: 'public',
    icon: 'book-open',
    criticalPath: true,

    steps: [
      {
        feature: 'public-blog',
        action: 'browse-posts',
        description: 'Reader browses blog homepage or category',
      },
      {
        feature: 'public-blog',
        action: 'select-post',
        description: 'Reader clicks on a post to read',
      },
      {
        feature: 'public-blog',
        action: 'read-content',
        description: 'Reader reads the full post content',
      },
    ],

    features: ['public-blog'],
  },

  'view-author': {
    name: 'View Author',
    description: 'Reader views an author profile and their posts',
    category: 'public',
    icon: 'user',
    criticalPath: false,

    steps: [
      {
        feature: 'authors',
        action: 'view-profile',
        description: 'Reader views author profile page',
      },
      {
        feature: 'authors',
        action: 'browse-author-posts',
        description: 'Reader browses posts by this author',
      },
    ],

    features: ['authors', 'public-blog'],
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
        description: 'Author views available plans',
      },
      {
        feature: 'plans',
        action: 'select-plan',
        description: 'Author selects a new plan',
      },
      {
        feature: 'billing',
        action: 'enter-payment',
        description: 'Author enters payment information',
      },
      {
        feature: 'billing',
        action: 'confirm-upgrade',
        description: 'Author confirms the upgrade',
      },
    ],

    features: ['plans', 'billing'],
  },
})
