/**
 * The columns every entity table has: implicit in ALL entities, never declared in entity field
 * configurations, always returned by the API.
 *
 * PORTABLE: no imports.
 */

/** All system field names that are implicit in every entity */
export const SYSTEM_FIELD_NAMES = ['id', 'createdAt', 'updatedAt', 'userId', 'teamId'] as const

export type SystemFieldName = (typeof SYSTEM_FIELD_NAMES)[number]
