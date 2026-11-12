/**
 * Audit Logs Entity Configuration
 *
 * The actions performed through the social media plugin (accounts connected, assigned and disconnected, posts
 * published or failed), read through core's generic entity API: GET /api/v1/audit-logs and /api/v1/audit-logs/:id.
 *
 * - Read-only (`access.api: { read: true }`): the plugin's own routes write the rows, and a log row is not edited,
 *   created or deleted through the generic API, which answers 405 to POST, PATCH and DELETE.
 * - Shared within the team (`access.shared: true`): whoever the project's permissions.config.ts grants
 *   `audit-logs.list` / `audit-logs.read` sees the team's rows, not only their own. Without those entries no
 *   team role may list them (a permission no config declares is denied). Suggested:
 *     'audit-logs': [
 *       { action: 'list', label: 'List audit logs', roles: ['owner', 'admin'] },
 *       { action: 'read', label: 'View audit logs', roles: ['owner', 'admin'] },
 *     ],
 * - The fields are the table's columns (social_audit_logs, see the plugin's migrations); `userId`, `teamId`,
 *   `createdAt` and `updatedAt` are system fields every entity has.
 */

import { History } from 'lucide-react'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'

const readOnly = { searchable: false, sortable: false, readOnly: true }

export const auditLogsEntityConfig: EntityConfig = {
  slug: 'audit-logs',
  tableName: 'social_audit_logs', // the table the plugin's migrations leave (003 renames the old audit_logs)
  enabled: true,
  names: {
    singular: 'Social Media Audit Log',
    plural: 'Social Media Audit Logs',
  },
  icon: History,

  access: {
    public: false,
    api: { read: true },
    metadata: false,
    shared: true,
  },

  ui: {
    dashboard: { showInMenu: false, showInTopbar: false },
    public: { hasArchivePage: false, hasSinglePage: false },
    features: { searchable: false, sortable: true, filterable: true, bulkOperations: false, importExport: false },
  },

  fields: [
    {
      name: 'action',
      type: 'select',
      required: true,
      options: [
        { value: 'account_connected', label: 'Account Connected' },
        { value: 'account_assigned', label: 'Account Assigned' },
        { value: 'account_disconnected', label: 'Account Disconnected' },
        { value: 'post_published', label: 'Post Published' },
        { value: 'post_failed', label: 'Post Failed' },
        { value: 'token_refreshed', label: 'Token Refreshed' },
      ],
      display: { label: 'Action', showInList: true, showInDetail: true, showInForm: false, order: 1 },
      api: { searchable: false, sortable: true, readOnly: true },
    },
    {
      name: 'accountId',
      type: 'text',
      required: false,
      display: {
        label: 'Account',
        description: 'The social account, or its assignment to a project entity (no foreign key: kept after the account is removed)',
        showInList: true,
        showInDetail: true,
        showInForm: false,
        order: 2,
      },
      api: readOnly,
    },
    {
      name: 'details',
      type: 'json',
      required: false,
      display: {
        label: 'Details',
        description: 'Platform, success, error message and the post or account involved',
        showInList: false,
        showInDetail: true,
        showInForm: false,
        order: 3,
      },
      api: readOnly,
    },
    {
      name: 'ipAddress',
      type: 'text',
      required: false,
      display: { label: 'IP Address', showInList: false, showInDetail: true, showInForm: false, order: 4 },
      api: readOnly,
    },
    {
      name: 'userAgent',
      type: 'text',
      required: false,
      display: { label: 'User Agent', showInList: false, showInDetail: true, showInForm: false, order: 5 },
      api: readOnly,
    },
  ],
}

export default auditLogsEntityConfig
