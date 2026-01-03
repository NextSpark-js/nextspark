import { EntityType, CreateMetaPayload } from '../../types/meta.types';
export declare class MetaService {
    /**
     * Obtener configuración de entidad
     */
    private static getEntityConfig;
    /**
     * Obtener todos los meta datos de una entidad
     */
    static getEntityMetas(entityType: EntityType, entityId: string, userId: string, includePrivate?: boolean): Promise<Record<string, unknown>>;
    /**
     * Obtener meta datos para múltiples entidades en bulk (soluciona N+1 queries)
     */
    static getBulkEntityMetas(entityType: EntityType, entityIds: string[], userId: string, includePrivate?: boolean): Promise<Record<string, Record<string, unknown>>>;
    /**
     * Obtener meta datos específicos de una entidad
     */
    static getSpecificEntityMetas(entityType: EntityType, entityId: string, metaKeys: string[], userId: string): Promise<Record<string, unknown>>;
    /**
     * Obtener meta datos específicos para múltiples entidades en bulk
     */
    static getBulkSpecificEntityMetas(entityType: EntityType, entityIds: string[], metaKeys: string[], userId: string): Promise<Record<string, Record<string, unknown>>>;
    /**
     * Obtener un meta dato específico
     */
    static getEntityMeta(entityType: EntityType, entityId: string, metaKey: string, userId: string): Promise<unknown>;
    /**
     * Establecer un meta dato
     *
     * NOTE: Metas tables do NOT have teamId column - security is inherited from parent entity via RLS.
     * This follows the CRM theme pattern where metadata access is controlled through the parent entity.
     */
    static setEntityMeta(entityType: EntityType, entityId: string, metaKey: string, metaValue: unknown, userId: string, options?: Partial<CreateMetaPayload>): Promise<void>;
    /**
     * Establecer múltiples meta datos en batch (optimizado con transacciones)
     */
    static setBulkEntityMetas(entityType: EntityType, entityId: string, metas: Record<string, unknown>, userId: string, options?: Partial<CreateMetaPayload>): Promise<void>;
    /**
     * Eliminar un meta dato
     */
    static deleteEntityMeta(entityType: EntityType, entityId: string, metaKey: string, userId: string): Promise<void>;
    /**
     * Eliminar todos los meta datos de una entidad
     */
    static deleteAllEntityMetas(entityType: EntityType, entityId: string, userId: string): Promise<void>;
    /**
     * Buscar entidades por meta datos (optimizado con límites)
     */
    static searchByMeta(entityType: EntityType, metaKey: string, metaValue: unknown, userId: string, limit?: number, offset?: number): Promise<{
        entities: string[];
        total: number;
    }>;
    /**
     * Contar meta datos por entidad
     */
    static countEntityMetas(entityType: EntityType, entityId: string, userId: string): Promise<number>;
}
//# sourceMappingURL=meta.service.d.ts.map