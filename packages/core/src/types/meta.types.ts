/**
 * Meta data system types - Entity Agnostic
 */

// Core entity types (only user is guaranteed to exist)
export type CoreEntityType = 'user';

// Dynamic entity type - can be any string
export type EntityType = string;
export type MetaDataType = 'string' | 'number' | 'boolean' | 'json' | 'array';

// Configuración de entidades para el sistema de meta datos
export interface EntityConfig {
  entityType: EntityType;
  tableName: string;           // Nombre de la tabla principal (ej: 'user', 'task')
  metaTableName: string;       // Nombre de la tabla de metas (ej: 'user_metas', 'task_metas')
  idColumn: string;            // Nombre de la columna ID en la tabla de metas (ej: 'userId', 'taskId')
  apiPath: string;             // Path base de la API (ej: 'users', 'tasks')
}

// Core entity configurations (only user is guaranteed)
export const CORE_ENTITY_CONFIGS: Record<CoreEntityType, EntityConfig> = {
  user: {
    entityType: 'user',
    tableName: 'users',           // ✅ Plural to match database table
    metaTableName: 'users_metas',  // ✅ Plural to match database table
    idColumn: 'userId',
    apiPath: 'users'
  }
};

// Helper function to get entity config dynamically
export function getEntityMetaConfig(entityType: string): EntityConfig | undefined {
  // First check core entities
  if (entityType in CORE_ENTITY_CONFIGS) {
    return CORE_ENTITY_CONFIGS[entityType as CoreEntityType];
  }

  // For dynamic entities, use entity registry to get correct configuration
  try {
    const { ENTITY_REGISTRY } = require('@nextsparkjs/registries/entity-registry')
    const entityConfig = ENTITY_REGISTRY[entityType]

    if (entityConfig) {
      // Use the actual slug from registry (plural form like 'tasks', 'products')
      const slug = entityConfig.apiPath || entityType

      // Convert slug to table name: PostgreSQL uses snake_case (underscores), not kebab-case (hyphens)
      // e.g., 'ai-history' -> 'ai_history', 'audit-logs' -> 'audit_logs'
      const tableName = slug.replace(/-/g, '_')

      return {
        entityType,
        tableName,  // Use converted tableName (e.g., 'tasks', 'ai_history', 'audit_logs')
        metaTableName: `${tableName}_metas`,  // e.g., 'tasks_metas', 'ai_history_metas'
        idColumn: 'entityId',  // All theme entity metas tables use generic 'entityId' column
        apiPath: slug  // Keep original slug for API paths (with hyphens for URLs)
      };
    }
  } catch (error) {
    console.warn(`Could not load entity registry for ${entityType}, falling back to convention`)
  }

  // Fallback to convention for unknown entities
  // Convert hyphens to underscores for PostgreSQL table names
  const fallbackTableName = entityType.replace(/-/g, '_')

  return {
    entityType,
    tableName: fallbackTableName,
    metaTableName: `${fallbackTableName}_metas`,
    idColumn: 'entityId',  // All theme entity metas tables use generic 'entityId' column
    apiPath: `${fallbackTableName}s`
  };
}

// Helper to check if entity is core
export function isCoreEntity(entityType: string): entityType is CoreEntityType {
  return entityType in CORE_ENTITY_CONFIGS;
}

// Interfaces base
export interface EntityMeta {
  id: string;
  metaKey: string;
  metaValue: unknown;
  dataType: MetaDataType;
  isPublic: boolean;
  isSearchable: boolean;
  createdAt: string;
  updatedAt: string;
}

// MetaSchema y ValidationRules eliminados - sistema completamente flexible

// API payloads genéricos
export interface CreateMetaPayload {
  metaKey: string;
  metaValue: unknown;
  dataType?: MetaDataType;
  isPublic?: boolean;
  isSearchable?: boolean;
}

export interface UpdateMetaPayload extends Partial<CreateMetaPayload> {
  id?: string; // Specific metadata update payload
}

export interface BulkMetaPayload {
  meta: Record<string, unknown>;
}

// Helper types para respuestas de API
export type EntityResponse<T> = T & { meta?: Record<string, unknown> };

// Tipo genérico para entidad con meta datos
export interface EntityWithMeta<T = Record<string, unknown>> {
  entity: T;
  meta: Record<string, unknown>; // Completamente flexible
}

// Tipo helper para acceso typesafe a meta datos conocidos
export type MetaValue<T = unknown> = T | undefined;

// Helper type para autocomplete en IDE (opcional)
export type KnownUserMetaKeys = 
  | 'securitySettings'
  | 'notificationPreferences' 
  | 'uiPreferences'
  | 'privacySettings';

// Removed hardcoded task meta keys - use dynamic approach

// Función helper para acceso typesafe (opcional)
export function getMetaValue<T = unknown>(
  meta: Record<string, unknown>, 
  key: string, 
  defaultValue?: T
): MetaValue<T> {
  return (meta?.[key] as T) ?? defaultValue;
}

// Core entity response types
export type UserResponse = EntityResponse<Record<string, unknown>>;

// Generic entity response type for dynamic entities
export type DynamicEntityResponse<T = Record<string, unknown>> = EntityResponse<T>;

