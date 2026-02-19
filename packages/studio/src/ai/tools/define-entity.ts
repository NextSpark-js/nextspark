/**
 * Tool: define_entity
 *
 * Creates a custom entity definition (data model) for the project.
 * Called for each business object detected in the user's description.
 *
 * NextSpark auto-generates: database table, CRUD API, forms, list views,
 * validation schemas, and RLS policies from this config.
 */

import { z } from 'zod'

const entityFieldSchema = z.object({
  name: z.string().regex(/^[a-z][a-zA-Z0-9]*$/).describe(
    'Field name in camelCase (e.g., "firstName", "membershipType"). NEVER include: id, createdAt, updatedAt, userId, teamId - these are automatic.'
  ),
  type: z.enum([
    'text', 'textarea', 'number', 'boolean', 'date', 'datetime',
    'email', 'url', 'phone', 'select', 'multiselect', 'tags',
    'image', 'file', 'rating', 'currency', 'richtext', 'markdown',
    'json', 'country', 'address', 'relation'
  ]).describe(
    'Field type. Use "text" for short strings, "textarea" for long text, "select" for fixed options, "relation" for foreign keys to other entities, "email"/"phone"/"url" for validated formats, "currency" for money amounts, "rating" for 1-5 stars.'
  ),
  required: z.boolean().default(false).describe('Whether this field is required'),
  description: z.string().optional().describe('Brief field description for form labels'),
  options: z.array(z.object({
    value: z.string().describe('Option value stored in database'),
    label: z.string().describe('Human-readable option label'),
  })).optional().describe(
    'For "select" and "multiselect" fields only. Define the available options.'
  ),
  relation: z.object({
    entity: z.string().describe('Related entity slug (e.g., "clients", "memberships")'),
    titleField: z.string().optional().describe('Field to display from related entity (default: "name")'),
  }).optional().describe(
    'For "relation" fields only. Defines which entity this field references.'
  ),
})

export const defineEntitySchema = z.object({
  slug: z.string().regex(/^[a-z][a-z0-9-]*$/).describe(
    'Entity slug in lowercase with hyphens (e.g., "clients", "gym-memberships"). This becomes the database table name and API path.'
  ),
  names: z.object({
    singular: z.string().describe('Singular name for UI (e.g., "client", "membership")'),
    plural: z.string().describe('Plural name for UI (e.g., "Clients", "Memberships")'),
  }),
  description: z.string().describe('What this entity represents in the business context'),
  accessMode: z.enum(['private', 'shared', 'public', 'team']).describe(
    '"private": only creator sees records. "shared": all authenticated users see all records. "public": visible without login. "team": team-scoped with RLS (most common for SaaS).'
  ),
  fields: z.array(entityFieldSchema).min(1).describe(
    'Entity fields. Do NOT include system fields (id, createdAt, updatedAt, userId, teamId) - they are automatic. Include 3-15 business-relevant fields.'
  ),
  features: z.object({
    searchable: z.boolean().default(true).describe('Include in global search'),
    sortable: z.boolean().default(true).describe('Allow column sorting in list view'),
    filterable: z.boolean().default(true).describe('Show filter controls'),
    bulkOperations: z.boolean().default(false).describe('Allow bulk select/delete'),
    importExport: z.boolean().default(false).describe('Allow CSV import/export'),
    pageBuilder: z.boolean().default(false).describe('Enable page builder for this entity (for content entities like pages/posts)'),
  }).optional(),
})

export type DefineEntityInput = z.infer<typeof defineEntitySchema>

export const DEFINE_ENTITY_TOOL = {
  name: 'define_entity' as const,
  description: 'Define a custom entity (data model) for the project. Each entity becomes a database table with automatic CRUD API, validation, forms, list views, and row-level security. Call this for each business object the user needs (e.g., clients, products, orders, memberships). CRITICAL: Never include system fields (id, createdAt, updatedAt, userId, teamId) in the fields array - they are added automatically. Field names MUST be camelCase.',
  schema: defineEntitySchema,
}
