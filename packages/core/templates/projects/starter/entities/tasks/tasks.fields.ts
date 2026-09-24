/**
 * Task Entity Fields Configuration - Starter Theme
 *
 * Contains all field definitions for the tasks entity.
 */

import type { EntityField } from '@nextsparkjs/core/lib/entities/types'

export const taskFields: EntityField[] = [
  {
    name: 'title',
    type: 'text',
    required: true,
    display: {
      label: 'Title',
      description: 'Task title or name',
      placeholder: 'Enter task title...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 1,
      columnWidth: 12,
    },
    api: {
      readOnly: false,
      searchable: true,
      sortable: true,
    },
  },
  {
    name: 'description',
    type: 'textarea',
    required: false,
    display: {
      label: 'Description',
      description: 'Detailed task description',
      placeholder: 'Enter task description...',
      showInList: false,
      showInDetail: true,
      showInForm: true,
      order: 2,
      columnWidth: 12,
    },
    api: {
      readOnly: false,
      searchable: true,
      sortable: false,
    },
  },
  {
    name: 'status',
    type: 'select',
    required: false,
    defaultValue: 'todo',
    options: [
      { value: 'todo', label: 'To Do' },
      { value: 'in-progress', label: 'In Progress' },
      { value: 'review', label: 'In Review' },
      { value: 'done', label: 'Done' },
      { value: 'blocked', label: 'Blocked' },
    ],
    display: {
      label: 'Status',
      description: 'Current task status',
      placeholder: 'Select status...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 3,
      columnWidth: 4,
    },
    api: {
      readOnly: false,
      searchable: false,
      sortable: true,
    },
  },
  {
    name: 'priority',
    type: 'select',
    required: false,
    defaultValue: 'medium',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
      { value: 'urgent', label: 'Urgent' },
    ],
    display: {
      label: 'Priority',
      description: 'Task priority level',
      placeholder: 'Select priority...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 4,
      columnWidth: 4,
    },
    api: {
      readOnly: false,
      searchable: false,
      sortable: true,
    },
  },
  {
    name: 'tags',
    type: 'tags',
    required: false,
    display: {
      label: 'Tags',
      description: 'Task tags for categorization',
      placeholder: 'Add tags...',
      showInList: false,
      showInDetail: true,
      showInForm: true,
      order: 5,
      columnWidth: 6,
    },
    api: {
      readOnly: false,
      searchable: true,
      sortable: false,
    },
  },
  {
    name: 'dueDate',
    type: 'date',
    required: false,
    display: {
      label: 'Due Date',
      description: 'Task deadline',
      placeholder: 'Select due date...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 6,
      columnWidth: 4,
    },
    api: {
      readOnly: false,
      searchable: false,
      sortable: true,
    },
  },
  {
    name: 'estimatedHours',
    type: 'number',
    required: false,
    display: {
      label: 'Estimated Hours',
      description: 'Estimated time to complete (in hours)',
      placeholder: '0',
      showInList: false,
      showInDetail: true,
      showInForm: true,
      order: 7,
      columnWidth: 4,
    },
    api: {
      readOnly: false,
      searchable: false,
      sortable: true,
    },
  },
  {
    name: 'completed',
    type: 'boolean',
    required: false,
    defaultValue: false,
    display: {
      label: 'Completed',
      description: 'Mark as completed (legacy field, use status instead)',
      showInList: false,
      showInDetail: true,
      showInForm: false,
      order: 8,
      columnWidth: 4,
    },
    api: {
      readOnly: false,
      searchable: false,
      sortable: true,
    },
  },
  // NOTE: createdAt and updatedAt are implicit system fields
  // They are automatically included by the API and frontend components
  // Do NOT declare them here - see core/lib/entities/system-fields.ts
]
