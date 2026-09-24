/**
 * Customers Entity Fields Configuration
 *
 * Separated from main config according to new refactoring plan.
 * Contains all field definitions for the customers entity.
 */

import type { EntityField } from '@nextsparkjs/core/lib/entities/types'

export const customersFields: EntityField[] = [
  {
    name: 'name',
    type: 'text',
    required: true,
    display: {
      label: 'Name',
      description: 'Customer name',
      placeholder: 'Enter customer name...',
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
    name: 'account',
    type: 'number',
    required: true,
    display: {
      label: 'Account Number',
      description: 'Unique customer account number (used for identification and external integrations)',
      placeholder: 'Enter account number...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 2,
      columnWidth: 3,
    },
    api: {
      searchable: true,
      sortable: true,
      readOnly: false,
    },
  },
  {
    name: 'office',
    type: 'text',
    required: true,
    display: {
      label: 'Office',
      description: 'Customer office/branch',
      placeholder: 'Enter office...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 3,
      columnWidth: 3,
    },
    api: {
      searchable: true,
      sortable: true,
      readOnly: false,
    },
  },
  {
    name: 'phone',
    type: 'text',
    required: false,
    display: {
      label: 'Phone',
      description: 'Customer phone number',
      placeholder: 'Enter phone number...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 4,
      columnWidth: 4,
    },
    api: {
      searchable: true,
      sortable: false,
      readOnly: false,
    },
  },
  {
    name: 'salesRep',
    type: 'text',
    required: false,
    display: {
      label: 'Sales Representative',
      description: 'Assigned sales representative',
      placeholder: 'Enter sales rep...',
      showInList: true,
      showInDetail: true,
      showInForm: true,
      order: 5,
      columnWidth: 4,
    },
    api: {
      searchable: true,
      sortable: true,
      readOnly: false,
    },
  },
  {
    name: 'visitDays',
    type: 'multiselect',
    required: false,
    options: [
      { value: 'lun', label: 'Lunes' },
      { value: 'mar', label: 'Martes' },
      { value: 'mie', label: 'Miércoles' },
      { value: 'jue', label: 'Jueves' },
      { value: 'vie', label: 'Viernes' },
    ],
    display: {
      label: 'Visit Days',
      description: 'Scheduled visit days (Monday to Friday)',
      placeholder: 'Select visit days...',
      showInList: false,
      showInDetail: true,
      showInForm: true,
      order: 6,
      columnWidth: 4,
    },
    api: {
      searchable: false,
      sortable: false,
      readOnly: false,
    },
  },
  {
    name: 'contactDays',
    type: 'multiselect',
    required: false,
    options: [
      { value: 'lun', label: 'Lunes' },
      { value: 'mar', label: 'Martes' },
      { value: 'mie', label: 'Miércoles' },
      { value: 'jue', label: 'Jueves' },
      { value: 'vie', label: 'Viernes' },
    ],
    display: {
      label: 'Contact Days',
      description: 'Preferred contact days (Monday to Friday)',
      placeholder: 'Select contact days...',
      showInList: false,
      showInDetail: true,
      showInForm: true,
      order: 7,
      columnWidth: 4,
    },
    api: {
      searchable: false,
      sortable: false,
      readOnly: false,
    },
  },
]
