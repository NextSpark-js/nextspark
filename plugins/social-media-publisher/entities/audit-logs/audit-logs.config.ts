/**
 * Audit Logs Entity Configuration
 *
 * Tracks all actions performed through the social media plugin
 * For security, compliance, and debugging
 */

import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'

export const auditLogsEntityConfig: any = {
  name: 'audit-logs',
  label: {
    en: 'Social Media Audit Logs',
    es: 'Registros de Auditoría de Redes Sociales'
  },
  description: {
    en: 'Security and audit trail for social media actions',
    es: 'Pista de auditoría y seguridad para acciones de redes sociales'
  },

  fields: [
    {
      name: 'user_id',
      label: { en: 'User', es: 'Usuario' },
      type: 'relation',
      relation: {
        entity: 'users',
        titleField: 'email'
      },
      required: true,
      index: true
    },
    {
      name: 'account_id',
      label: { en: 'Social Platform Account', es: 'Cuenta de Plataforma Social' },
      type: 'relation',
      relation: {
        entity: 'social-platforms',
        titleField: 'username'
      },
      required: false,
      index: true
    },
    {
      name: 'action',
      label: { en: 'Action', es: 'Acción' },
      type: 'select',
      options: [
        { value: 'account_connected', label: 'Account Connected' },
        { value: 'account_disconnected', label: 'Account Disconnected' },
        { value: 'post_published', label: 'Post Published' },
        { value: 'post_failed', label: 'Post Failed' },
        { value: 'token_refreshed', label: 'Token Refreshed' },
        { value: 'token_refresh_failed', label: 'Token Refresh Failed' }
      ],
      required: true,
      index: true
    },
    {
      name: 'details',
      label: { en: 'Details', es: 'Detalles' },
      type: 'json',
      default: {},
      description: {
        en: 'Action details: platform, success status, error messages, metadata',
        es: 'Detalles de acción: plataforma, estado de éxito, mensajes de error, metadatos'
      }
    },
    {
      name: 'ip_address',
      label: { en: 'IP Address', es: 'Dirección IP' },
      type: 'string',
      required: false,
      description: {
        en: 'User IP address at time of action',
        es: 'Dirección IP del usuario al momento de la acción'
      }
    },
    {
      name: 'user_agent',
      label: { en: 'User Agent', es: 'Agente de Usuario' },
      type: 'string',
      required: false,
      description: {
        en: 'Browser/device user agent string',
        es: 'String de agente de usuario del navegador/dispositivo'
      }
    }
  ],

  // Database indexes for performance
  indexes: [
    {
      fields: ['user_id', 'created_at'],
      name: 'idx_audit_logs_user_created'
    },
    {
      fields: ['account_id', 'action'],
      name: 'idx_audit_logs_account_action'
    },
    {
      fields: ['action', 'created_at'],
      name: 'idx_audit_logs_action_created'
    },
    {
      fields: ['created_at'],
      name: 'idx_audit_logs_created',
      order: 'DESC' // Most recent first
    }
  ],

  // Row-level security
  permissions: {
    actions: [
      {
        action: 'create',
        label: 'Create audit logs',
        description: 'Can create audit log entries (typically system-only)',
        defaultRoles: [], // Only system creates logs, no user role has this permission
      },
      {
        action: 'read',
        label: 'View audit logs',
        description: 'Can view audit log entries',
        defaultRoles: ['owner', 'admin'],
      },
      {
        action: 'list',
        label: 'List audit logs',
        description: 'Can list audit log entries',
        defaultRoles: ['owner', 'admin'],
      },
      {
        action: 'update',
        label: 'Edit audit logs',
        description: 'Audit logs are immutable - no one can update',
        defaultRoles: [], // Immutable - empty array
      },
      {
        action: 'delete',
        label: 'Delete audit logs',
        description: 'Can delete old audit log entries',
        defaultRoles: ['owner', 'admin'],
        dangerous: true,
      },
    ],
  }
}

export default auditLogsEntityConfig
