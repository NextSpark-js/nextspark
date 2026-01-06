/**
 * Pipelines Entity Fields Configuration
 *
 * Separated from main config according to new refactoring plan.
 * Contains all field definitions for the pipelines entity.
 */

import type { EntityField } from '@nextsparkjs/core/lib/entities/types'

export const pipelinesFields: EntityField[] = [
  {
    name: 'name',
    type: 'text',
    required: true,
    display: {
      label: 'Pipeline Name',
      description: 'Pipeline name',
      placeholder: 'Enter pipeline name...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 1,
      columnWidth: 6,
    },
    api: {
      searchable: true,
      sortable: true,
      readOnly: false,
    },
  },
  {
    name: 'description',
    type: 'textarea',
    required: false,
    display: {
      label: 'Description',
      description: 'Pipeline description',
      placeholder: 'Enter description...',
      showInList: false,
      showInDetail: true,
      showInForm: true,
      order: 2,
      columnWidth: 6,
    },
    api: {
      searchable: true,
      sortable: false,
      readOnly: false,
    },
  },
  {
    name: 'type',
    type: 'select',
    required: false,
    options: [
      { value: 'sales', label: 'Sales' },
      { value: 'support', label: 'Support' },
      { value: 'project', label: 'Project' },
      { value: 'custom', label: 'Custom' },
    ],
    display: {
      label: 'Pipeline Type',
      description: 'Type of pipeline',
      placeholder: 'Select type...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 3,
      columnWidth: 4,
    },
    api: {
      searchable: false,
      sortable: true,
      readOnly: false,
    },
  },
  {
    name: 'isDefault',
    type: 'boolean',
    required: false,
    display: {
      label: 'Default Pipeline',
      description: 'Is this the default pipeline',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 4,
      columnWidth: 4,
    },
    api: {
      searchable: false,
      sortable: true,
      readOnly: false,
    },
  },
  {
    name: 'isActive',
    type: 'boolean',
    required: false,
    display: {
      label: 'Active',
      description: 'Is pipeline currently active',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 5,
      columnWidth: 4,
    },
    api: {
      searchable: false,
      sortable: true,
      readOnly: false,
    },
  },
  {
    name: 'stages',
    type: 'json',
    required: true,
    display: {
      label: 'Pipeline Stages',
      description: 'Pipeline stages configuration as JSON array',
      placeholder: 'Configure stages...',
      showInList: false,
      showInDetail: true,
      showInForm: true,
      order: 6,
      columnWidth: 12,
    },
    api: {
      searchable: false,
      sortable: false,
      readOnly: false,
    },
  },
  {
    name: 'dealRottenDays',
    type: 'number',
    required: false,
    display: {
      label: 'Deal Rotten Days',
      description: 'Days until deal is considered stale',
      placeholder: '30',
      showInList: false,
      showInDetail: true,
      showInForm: true,
      order: 7,
      columnWidth: 4,
    },
    api: {
      searchable: false,
      sortable: true,
      readOnly: false,
    },
  },
  {
    name: 'createdAt',
    type: 'datetime',
    required: false,
    display: {
      label: 'Created At',
      description: 'When the pipeline was created',
      showInList: true,
      showInDetail: true,
      showInForm: false,
      order: 98,
      columnWidth: 4,
    },
    api: {
      searchable: false,
      sortable: true,
      readOnly: true,
    },
  },
  {
    name: 'updatedAt',
    type: 'datetime',
    required: false,
    display: {
      label: 'Updated At',
      description: 'When the pipeline was last updated',
      showInList: false,
      showInDetail: true,
      showInForm: false,
      order: 99,
      columnWidth: 4,
    },
    api: {
      searchable: false,
      sortable: true,
      readOnly: true,
    },
  },
]