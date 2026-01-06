/**
 * AI History Entity Fields Configuration
 *
 * Generic AI interaction history for all plugins and operations.
 * Tracks AI usage with cost metrics and polymorphic relationships.
 *
 * Features:
 * - User tracking
 * - Polymorphic relationships (relatedEntityType + relatedEntityId)
 * - Cost and performance metrics
 * - Status tracking through operation lifecycle
 * - Support for multiple AI providers (Anthropic, OpenAI, etc.)
 */

import type { EntityField } from '@nextsparkjs/core/lib/entities/types'

export const aiHistoryFields: EntityField[] = [
  // User Relationship
  {
    name: 'userId',
    type: 'text',
    required: true,
    display: {
      label: 'User ID',
      description: 'User who initiated the AI operation',
      placeholder: 'User ID',
      showInList: true,
      showInDetail: true,
      showInForm: false,
      order: 1,
      columnWidth: 6,
    },
    api: {
      searchable: true,
      sortable: true,
      readOnly: true,
    },
  },

  // Polymorphic Relationship (Generic Entity Link)
  {
    name: 'relatedEntityType',
    type: 'text',
    required: false,
    display: {
      label: 'Related Entity Type',
      description: 'Type of entity this operation relates to (e.g., "contents", "products", "campaigns")',
      placeholder: 'contents',
      showInList: true,
      showInDetail: true,
      showInForm: false,
      order: 2,
      columnWidth: 6,
    },
    api: {
      searchable: true,
      sortable: true,
      readOnly: true,
    },
  },
  {
    name: 'relatedEntityId',
    type: 'text',
    required: false,
    display: {
      label: 'Related Entity ID',
      description: 'ID of the related entity (polymorphic relationship)',
      placeholder: 'Entity ID',
      showInList: false,
      showInDetail: true,
      showInForm: false,
      order: 3,
      columnWidth: 6,
    },
    api: {
      searchable: true,
      sortable: false,
      readOnly: true,
    },
  },

  // AI Operation Details
  {
    name: 'operation',
    type: 'select',
    required: true,
    options: [
      { value: 'generate', label: 'Generate' },
      { value: 'refine', label: 'Refine' },
      { value: 'analyze', label: 'Analyze' },
      { value: 'chat', label: 'Chat' },
      { value: 'completion', label: 'Completion' },
      { value: 'other', label: 'Other' },
    ],
    display: {
      label: 'Operation',
      description: 'Type of AI operation',
      placeholder: 'Select operation...',
      showInList: true,
      showInDetail: true,
      showInForm: false,
      order: 4,
      columnWidth: 4,
    },
    api: {
      searchable: true,
      sortable: true,
      readOnly: true,
    },
  },
  {
    name: 'model',
    type: 'text',
    required: true,
    display: {
      label: 'AI Model',
      description: 'AI model used (e.g., claude-3-5-sonnet-20241022, gpt-4)',
      placeholder: 'claude-3-5-sonnet-20241022',
      showInList: true,
      showInDetail: true,
      showInForm: false,
      order: 5,
      columnWidth: 4,
    },
    api: {
      searchable: true,
      sortable: true,
      readOnly: true,
    },
  },
  {
    name: 'provider',
    type: 'select',
    required: true,
    defaultValue: 'anthropic',
    options: [
      { value: 'anthropic', label: 'Anthropic' },
      { value: 'openai', label: 'OpenAI' },
      { value: 'google', label: 'Google' },
      { value: 'azure', label: 'Azure' },
      { value: 'other', label: 'Other' },
    ],
    display: {
      label: 'Provider',
      description: 'AI provider',
      placeholder: 'Select provider...',
      showInList: true,
      showInDetail: true,
      showInForm: false,
      order: 6,
      columnWidth: 4,
    },
    api: {
      searchable: true,
      sortable: true,
      readOnly: true,
    },
  },

  // Status and Metrics
  {
    name: 'status',
    type: 'select',
    required: true,
    defaultValue: 'pending',
    options: [
      { value: 'pending', label: 'Pending' },
      { value: 'processing', label: 'Processing' },
      { value: 'completed', label: 'Completed' },
      { value: 'failed', label: 'Failed' },
    ],
    display: {
      label: 'Status',
      description: 'Operation processing status',
      placeholder: 'Select status...',
      showInList: true,
      showInDetail: true,
      showInForm: false,
      order: 7,
      columnWidth: 3,
    },
    api: {
      searchable: true,
      sortable: true,
      readOnly: true,
    },
  },
  {
    name: 'tokensUsed',
    type: 'number',
    required: false,
    display: {
      label: 'Tokens Used',
      description: 'Total tokens consumed (input + output)',
      placeholder: '0',
      showInList: true,
      showInDetail: true,
      showInForm: false,
      order: 8,
      columnWidth: 3,
    },
    api: {
      searchable: false,
      sortable: true,
      readOnly: true,
    },
  },
  {
    name: 'creditsUsed',
    type: 'number',
    required: false,
    display: {
      label: 'Credits Used',
      description: 'Credits deducted for this operation',
      placeholder: '0',
      showInList: true,
      showInDetail: true,
      showInForm: false,
      order: 9,
      columnWidth: 3,
    },
    api: {
      searchable: false,
      sortable: true,
      readOnly: true,
    },
  },
  {
    name: 'estimatedCost',
    type: 'number',
    required: false,
    display: {
      label: 'Estimated Cost ($)',
      description: 'Cost in USD based on model pricing',
      placeholder: '0.00',
      showInList: true,
      showInDetail: true,
      showInForm: false,
      order: 10,
      columnWidth: 3,
    },
    api: {
      searchable: false,
      sortable: true,
      readOnly: true,
    },
  },
  {
    name: 'balanceAfter',
    type: 'number',
    required: false,
    display: {
      label: 'Balance After',
      description: 'User credit balance after this operation',
      placeholder: '0',
      showInList: false,
      showInDetail: true,
      showInForm: false,
      order: 11,
      columnWidth: 3,
    },
    api: {
      searchable: false,
      sortable: true,
      readOnly: true,
    },
  },

  // Error Tracking
  {
    name: 'errorMessage',
    type: 'textarea',
    required: false,
    display: {
      label: 'Error Message',
      description: 'Error message if operation failed',
      placeholder: 'Error details...',
      showInList: false,
      showInDetail: true,
      showInForm: false,
      order: 12,
      columnWidth: 12,
    },
    api: {
      searchable: false,
      sortable: false,
      readOnly: true,
    },
  },

  // Timestamps
  {
    name: 'createdAt',
    type: 'datetime',
    required: false,
    display: {
      label: 'Created At',
      description: 'When the AI operation was initiated',
      showInList: true,
      showInDetail: true,
      showInForm: false,
      order: 97,
      columnWidth: 6,
    },
    api: {
      searchable: false,
      sortable: true,
      readOnly: true,
    },
  },
  {
    name: 'completedAt',
    type: 'datetime',
    required: false,
    display: {
      label: 'Completed At',
      description: 'When the AI operation finished (success or failure)',
      showInList: false,
      showInDetail: true,
      showInForm: false,
      order: 98,
      columnWidth: 6,
    },
    api: {
      searchable: false,
      sortable: true,
      readOnly: true,
    },
  },
]
