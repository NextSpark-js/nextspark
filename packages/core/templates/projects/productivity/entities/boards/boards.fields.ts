/**
 * Boards Entity Fields Configuration
 */

import type { EntityField } from '@nextsparkjs/core/lib/entities/types'

export const boardFields: EntityField[] = [
  {
    name: 'name',
    type: 'text',
    required: true,
    display: {
      label: 'Name',
      description: 'Board name',
      placeholder: 'Enter board name...',
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
      description: 'Optional board description',
      placeholder: 'Describe what this board is for...',
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
    name: 'color',
    type: 'select',
    required: false,
    defaultValue: 'blue',
    options: [
      { value: 'blue', label: 'Blue' },
      { value: 'green', label: 'Green' },
      { value: 'purple', label: 'Purple' },
      { value: 'orange', label: 'Orange' },
      { value: 'red', label: 'Red' },
      { value: 'pink', label: 'Pink' },
      { value: 'gray', label: 'Gray' },
    ],
    display: {
      label: 'Color',
      description: 'Board background color',
      placeholder: 'Select color...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 3,
      columnWidth: 6,
    },
    api: {
      readOnly: false,
      searchable: false,
      sortable: false,
    },
  },
  {
    name: 'archived',
    type: 'boolean',
    required: false,
    defaultValue: false,
    display: {
      label: 'Archived',
      description: 'Archive this board',
      showInList: false,
      showInDetail: true,
      showInForm: true,
      order: 4,
      columnWidth: 6,
    },
    api: {
      readOnly: false,
      searchable: false,
      sortable: true,
    },
  },
  {
    name: 'position',
    type: 'number',
    required: false,
    defaultValue: 0,
    display: {
      label: 'Position',
      description: 'Display order',
      showInList: false,
      showInDetail: false,
      showInForm: false,
      order: 5,
    },
    api: {
      readOnly: false,
      searchable: false,
      sortable: true,
    },
  },
  {
    name: 'createdAt',
    type: 'datetime',
    required: false,
    display: {
      label: 'Created At',
      description: 'When the board was created',
      showInList: true,
      showInDetail: true,
      showInForm: false,
      order: 98,
    },
    api: {
      readOnly: true,
      searchable: false,
      sortable: true,
    },
  },
  {
    name: 'updatedAt',
    type: 'datetime',
    required: false,
    display: {
      label: 'Updated At',
      description: 'When the board was last modified',
      showInList: false,
      showInDetail: true,
      showInForm: false,
      order: 99,
    },
    api: {
      readOnly: true,
      searchable: false,
      sortable: true,
    },
  },
]

