/**
 * Meta data system types - Entity Agnostic
 */
export type CoreEntityType = 'user';
export type EntityType = string;
export type MetaDataType = 'string' | 'number' | 'boolean' | 'json' | 'array';
export interface EntityConfig {
    entityType: EntityType;
    tableName: string;
    metaTableName: string;
    idColumn: string;
    apiPath: string;
}
export declare const CORE_ENTITY_CONFIGS: Record<CoreEntityType, EntityConfig>;
export declare function getEntityMetaConfig(entityType: string): EntityConfig | undefined;
export declare function isCoreEntity(entityType: string): entityType is CoreEntityType;
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
export interface CreateMetaPayload {
    metaKey: string;
    metaValue: unknown;
    dataType?: MetaDataType;
    isPublic?: boolean;
    isSearchable?: boolean;
}
export interface UpdateMetaPayload extends Partial<CreateMetaPayload> {
    id?: string;
}
export interface BulkMetaPayload {
    meta: Record<string, unknown>;
}
export type EntityResponse<T> = T & {
    meta?: Record<string, unknown>;
};
export interface EntityWithMeta<T = Record<string, unknown>> {
    entity: T;
    meta: Record<string, unknown>;
}
export type MetaValue<T = unknown> = T | undefined;
export type KnownUserMetaKeys = 'securitySettings' | 'notificationPreferences' | 'uiPreferences' | 'privacySettings';
export declare function getMetaValue<T = unknown>(meta: Record<string, unknown>, key: string, defaultValue?: T): MetaValue<T>;
export type UserResponse = EntityResponse<Record<string, unknown>>;
export type DynamicEntityResponse<T = Record<string, unknown>> = EntityResponse<T>;
//# sourceMappingURL=meta.types.d.ts.map