/**
 * Lists Entity Fields Configuration
 */

import type { EntityField } from '@nextsparkjs/core/lib/entities/types'

export const listFields: EntityField[] = [
  {
    name: 'name',
    type: 'text',
    required: true,
    display: {
      label: 'Name',
      description: 'List name',
      placeholder: 'Enter list name...',
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
    name: 'position',
    type: 'number',
    required: false,
    defaultValue: 0,
    display: {
      label: 'Position',
      description: 'Display order within board',
      showInList: false,
      showInDetail: false,
      showInForm: false,
      order: 2,
    },
    api: {
      readOnly: false,
      searchable: false,
      sortable: true,
    },
  },
  {
    name: 'boardId',
    type: 'reference',
    required: true,
    referenceEntity: 'boards',
    display: {
      label: 'Board',
      description: 'Parent board',
      placeholder: 'Select board...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 3,
      columnWidth: 12,
    },
    api: {
      readOnly: false,
      searchable: false,
      sortable: false,
    },
  },
  {
    name: 'createdAt',
    type: 'datetime',
    required: false,
    display: {
      label: 'Created At',
      description: 'When the list was created',
      showInList: false,
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
      description: 'When the list was last modified',
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

