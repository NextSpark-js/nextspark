import { queryWithRLS, mutateWithRLS } from '../db';
import { 
  EntityConfig, 
  getEntityMetaConfig, 
  EntityType, 
  EntityMeta, 
  CreateMetaPayload
} from '../../types/meta.types';

export class MetaService {
  /**
   * Obtener configuración de entidad
   */
  private static getEntityConfig(entityType: EntityType): EntityConfig {
    const config = getEntityMetaConfig(entityType);
    if (!config) {
      throw new Error(`Entity type '${entityType}' not configured`);
    }
    return config;
  }

  /**
   * Obtener todos los meta datos de una entidad
   */
  static async getEntityMetas(
    entityType: EntityType,
    entityId: string,
    userId: string,
    includePrivate: boolean = false
  ): Promise<Record<string, unknown>> {
    const config = this.getEntityConfig(entityType);
    
    // TODO: Cache key para optimización futura
    // const cacheKey = `meta:${entityType}:${entityId}:${includePrivate}`;
    
    const whereClause = includePrivate 
      ? `WHERE "${config.idColumn}" = $1`
      : `WHERE "${config.idColumn}" = $1 AND "isPublic" = true`;

    const metas = await queryWithRLS<EntityMeta>(
      `SELECT "metaKey", "metaValue" FROM "${config.metaTableName}" ${whereClause} ORDER BY "metaKey"`,
      [entityId],
      userId
    );

    const result = (metas || []).reduce((acc, meta) => {
      acc[meta.metaKey] = meta.metaValue;
      return acc;
    }, {} as Record<string, unknown>);

    return result;
  }

  /**
   * Obtener meta datos para múltiples entidades en bulk (soluciona N+1 queries)
   */
  static async getBulkEntityMetas(
    entityType: EntityType,
    entityIds: string[],
    userId: string,
    includePrivate: boolean = false
  ): Promise<Record<string, Record<string, unknown>>> {
    if (entityIds.length === 0) {
      return {};
    }

    const config = this.getEntityConfig(entityType);
    
    // Crear placeholders para los IDs
    const idPlaceholders = entityIds.map((_, index) => `$${index + 1}`).join(',');
    
    const whereClause = includePrivate 
      ? `WHERE "${config.idColumn}" IN (${idPlaceholders})`
      : `WHERE "${config.idColumn}" IN (${idPlaceholders}) AND "isPublic" = true`;

    const metas = await queryWithRLS<EntityMeta & { [key: string]: string }>(
      `SELECT "${config.idColumn}" as "entityId", "metaKey", "metaValue" 
       FROM "${config.metaTableName}" 
       ${whereClause} 
       ORDER BY "${config.idColumn}", "metaKey"`,
      entityIds,
      userId
    );

    // Agrupar meta datos por entityId
    const result = entityIds.reduce((acc, entityId) => {
      acc[entityId] = {};
      return acc;
    }, {} as Record<string, Record<string, unknown>>);

    metas.forEach(meta => {
      const entityId = meta.entityId;
      if (result[entityId]) {
        result[entityId][meta.metaKey] = meta.metaValue;
      }
    });

    return result;
  }

  /**
   * Obtener meta datos específicos de una entidad
   */
  static async getSpecificEntityMetas(
    entityType: EntityType,
    entityId: string,
    metaKeys: string[],
    userId: string
  ): Promise<Record<string, unknown>> {
    const config = this.getEntityConfig(entityType);
    
    if (metaKeys.length === 0) {
      return {};
    }

    // Crear placeholders para la query
    const placeholders = metaKeys.map((_, index) => `$${index + 2}`).join(',');
    
    const metas = await queryWithRLS<EntityMeta>(
      `SELECT "metaKey", "metaValue" FROM "${config.metaTableName}" 
       WHERE "${config.idColumn}" = $1 AND "metaKey" IN (${placeholders}) 
       ORDER BY "metaKey"`,
      [entityId, ...metaKeys],
      userId
    );

    const result = (metas || []).reduce((acc, meta) => {
      acc[meta.metaKey] = meta.metaValue;
      return acc;
    }, {} as Record<string, unknown>);

    return result;
  }

  /**
   * Obtener meta datos específicos para múltiples entidades en bulk
   */
  static async getBulkSpecificEntityMetas(
    entityType: EntityType,
    entityIds: string[],
    metaKeys: string[],
    userId: string
  ): Promise<Record<string, Record<string, unknown>>> {
    if (entityIds.length === 0 || metaKeys.length === 0) {
      return {};
    }

    const config = this.getEntityConfig(entityType);
    
    // Crear placeholders para los IDs y metaKeys
    const idPlaceholders = entityIds.map((_, index) => `$${index + 1}`).join(',');
    const keyPlaceholders = metaKeys.map((_, index) => `$${index + entityIds.length + 1}`).join(',');

    const metas = await queryWithRLS<EntityMeta & { [key: string]: string }>(
      `SELECT "${config.idColumn}" as "entityId", "metaKey", "metaValue" 
       FROM "${config.metaTableName}" 
       WHERE "${config.idColumn}" IN (${idPlaceholders}) 
       AND "metaKey" IN (${keyPlaceholders})
       ORDER BY "${config.idColumn}", "metaKey"`,
      [...entityIds, ...metaKeys],
      userId
    );

    // Agrupar meta datos por entityId
    const result = entityIds.reduce((acc, entityId) => {
      acc[entityId] = {};
      return acc;
    }, {} as Record<string, Record<string, unknown>>);

    metas.forEach(meta => {
      const entityId = meta.entityId;
      if (result[entityId]) {
        result[entityId][meta.metaKey] = meta.metaValue;
      }
    });

    return result;
  }

  /**
   * Obtener un meta dato específico
   */
  static async getEntityMeta(
    entityType: EntityType,
    entityId: string,
    metaKey: string,
    userId: string
  ): Promise<unknown> {
    const config = this.getEntityConfig(entityType);

    const result = await queryWithRLS<{ metaValue: unknown }>(
      `SELECT "metaValue" FROM "${config.metaTableName}"
       WHERE "${config.idColumn}" = $1 AND "metaKey" = $2`,
      [entityId, metaKey],
      userId
    );

    return result[0]?.metaValue || null;
  }

  /**
   * Establecer un meta dato
   *
   * NOTE: Metas tables do NOT have teamId column - security is inherited from parent entity via RLS.
   * This follows the CRM theme pattern where metadata access is controlled through the parent entity.
   */
  static async setEntityMeta(
    entityType: EntityType,
    entityId: string,
    metaKey: string,
    metaValue: unknown,
    userId: string,
    options: Partial<CreateMetaPayload> = {}
  ): Promise<void> {
    const config = this.getEntityConfig(entityType);

    // Validations that were previously in the stored procedure
    // Validate table name ends with _metas for security
    if (!config.metaTableName.endsWith('_metas')) {
      throw new Error(`Invalid meta table name: ${config.metaTableName}`);
    }

    // Validate metaKey is not empty
    if (!metaKey || metaKey.trim() === '') {
      throw new Error('Meta key cannot be empty');
    }

    // Validate metaKey length (max 100 chars)
    if (metaKey.length > 100) {
      throw new Error('Meta key too long (max 100 characters)');
    }

    // Validate JSON size (max 1MB for performance)
    const jsonString = JSON.stringify(metaValue);
    if (new TextEncoder().encode(jsonString).length > 1048576) {
      throw new Error('Meta value too large (max 1MB)');
    }

    // Standard query - no teamId column in metas tables
    // Security is handled by RLS policies that check parent entity team membership
    const query = `
      INSERT INTO "${config.metaTableName}"
        ("${config.idColumn}", "metaKey", "metaValue", "dataType", "isPublic", "isSearchable")
      VALUES ($1, $2, $3::jsonb, $4, $5, $6)
      ON CONFLICT ("${config.idColumn}", "metaKey")
      DO UPDATE SET
        "metaValue" = EXCLUDED."metaValue",
        "dataType" = EXCLUDED."dataType",
        "isPublic" = EXCLUDED."isPublic",
        "isSearchable" = EXCLUDED."isSearchable",
        "updatedAt" = CURRENT_TIMESTAMP
    `;
    const params = [
      entityId,
      metaKey,
      jsonString,
      options.dataType || 'json',
      options.isPublic || false,
      options.isSearchable || false
    ];

    await mutateWithRLS(query, params, userId);
  }

  /**
   * Establecer múltiples meta datos en batch (optimizado con transacciones)
   */
  static async setBulkEntityMetas(
    entityType: EntityType,
    entityId: string,
    metas: Record<string, unknown>,
    userId: string,
    options: Partial<CreateMetaPayload> = {}
  ): Promise<void> {
    // const config = this.getEntityConfig(entityType); // TODO: Use for validation
    
    // Límite de meta datos por entidad para escalabilidad
    const MAX_META_KEYS = 50;
    const existingCount = await this.countEntityMetas(entityType, entityId, userId);
    
    if (existingCount + Object.keys(metas).length > MAX_META_KEYS) {
      throw new Error(`Maximum ${MAX_META_KEYS} meta keys allowed per entity`);
    }

    // Usar transacción para mejor performance y consistencia
    const metaEntries = Object.entries(metas);
    const batchSize = 10; // Procesar en lotes para evitar bloqueos largos
    
    for (let i = 0; i < metaEntries.length; i += batchSize) {
      const batch = metaEntries.slice(i, i + batchSize);
      const promises = batch.map(([key, value]) =>
        this.setEntityMeta(entityType, entityId, key, value, userId, options)
      );
      await Promise.all(promises);
    }
  }

  /**
   * Eliminar un meta dato
   */
  static async deleteEntityMeta(
    entityType: EntityType,
    entityId: string,
    metaKey: string,
    userId: string
  ): Promise<void> {
    const config = this.getEntityConfig(entityType);
    
    await mutateWithRLS(
      `DELETE FROM "${config.metaTableName}" WHERE "${config.idColumn}" = $1 AND "metaKey" = $2`,
      [entityId, metaKey],
      userId
    );
  }

  /**
   * Eliminar todos los meta datos de una entidad
   */
  static async deleteAllEntityMetas(
    entityType: EntityType,
    entityId: string,
    userId: string
  ): Promise<void> {
    const config = this.getEntityConfig(entityType);
    
    await mutateWithRLS(
      `DELETE FROM "${config.metaTableName}" WHERE "${config.idColumn}" = $1`,
      [entityId],
      userId
    );
  }

  // getMetaSchemas eliminado - sistema completamente flexible sin schemas predefinidos

  /**
   * Buscar entidades por meta datos (optimizado con límites)
   */
  static async searchByMeta(
    entityType: EntityType,
    metaKey: string,
    metaValue: unknown,
    userId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ entities: string[], total: number }> {
    const config = this.getEntityConfig(entityType);
    
    // Primero obtener el total para paginación
    const countResult = await queryWithRLS<{ count: number }>(
      `SELECT COUNT(DISTINCT "${config.idColumn}") as count
       FROM "${config.metaTableName}" 
       WHERE "metaKey" = $1 
         AND "metaValue" @> $2
         AND "isSearchable" = true`,
      [metaKey, JSON.stringify(metaValue)],
      userId
    );

    // Luego obtener los resultados paginados
    const entities = await queryWithRLS<Record<string, string>>(
      `SELECT DISTINCT "${config.idColumn}" as "entityId"
       FROM "${config.metaTableName}" 
       WHERE "metaKey" = $1 
         AND "metaValue" @> $2
         AND "isSearchable" = true
       ORDER BY "entityId"
       LIMIT $3 OFFSET $4`,
      [metaKey, JSON.stringify(metaValue), limit, offset],
      userId
    );

    return {
      entities: entities.map(e => e.entityId),
      total: countResult[0]?.count || 0
    };
  }

  /**
   * Contar meta datos por entidad
   */
  static async countEntityMetas(
    entityType: EntityType,
    entityId: string,
    userId: string
  ): Promise<number> {
    const config = this.getEntityConfig(entityType);
    
    const result = await queryWithRLS<{ count: number }>(
      `SELECT COUNT(*) as count FROM "${config.metaTableName}" WHERE "${config.idColumn}" = $1`,
      [entityId],
      userId
    );

    return result[0]?.count || 0;
  }
}

