import { queryWithRLS, mutateWithRLS } from '../db';
import { 
  EntityConfig, 
  getEntityMetaConfig, 
  EntityType, 
  EntityMeta, 
  CreateMetaPayload
} from '../../types/meta.types';

const MAX_META_VALUE_BYTES = 1048576;

/** A meta value over the 1 MiB limit, on its own or once merged with the stored value. */
export class MetaValueTooLargeError extends Error {
  constructor(message = 'Meta value too large (max 1MB)') {
    super(message);
    this.name = 'MetaValueTooLargeError';
  }
}

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
   * Validations that were previously in the stored procedure, shared by every
   * method that writes a meta value. Returns the JSON string for the `::jsonb`
   * cast so callers don't serialize `metaValue` twice.
   */
  private static validateMetaWrite(config: EntityConfig, metaKey: string, metaValue: unknown): string {
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
    if (new TextEncoder().encode(jsonString).length > MAX_META_VALUE_BYTES) {
      throw new MetaValueTooLargeError();
    }

    return jsonString;
  }

  /**
   * SQL condition: a jsonb value is within the limit as Postgres stores it.
   * jsonb is normalized when stored, and its text form puts a space after
   * every `:` and `,`, so a value within the limit as compact JSON can exceed
   * it once stored. The limit is measured on that text form.
   */
  private static fitsMetaLimit(jsonbExpression: string): string {
    return `octet_length((${jsonbExpression})::text) <= ${MAX_META_VALUE_BYTES}`;
  }

  /**
   * The INSERT of one meta row, $1-$6 being id, key, value, data type, public
   * and searchable. It inserts nothing when the value is over the limit as
   * stored; the caller appends its ON CONFLICT clause and checks rowCount.
   */
  private static insertMetaRowSql(config: EntityConfig): string {
    return `
      INSERT INTO "${config.metaTableName}"
        ("${config.idColumn}", "metaKey", "metaValue", "dataType", "isPublic", "isSearchable")
      SELECT $1, $2, incoming.value, $4, $5, $6
        FROM (SELECT $3::jsonb AS value) incoming
       WHERE ${this.fitsMetaLimit('incoming.value')}`;
  }

  /**
   * Establecer un meta dato
   *
   * NOTE: Metas tables do NOT have teamId column - security is inherited from parent entity via RLS.
   * This follows the CRM theme pattern where metadata access is controlled through the parent entity.
   *
   * Throws MetaValueTooLargeError, writing nothing, when the value is over
   * 1 MiB as Postgres stores it.
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
    const jsonString = this.validateMetaWrite(config, metaKey, metaValue);

    // Standard query - no teamId column in metas tables
    // Security is handled by RLS policies that check parent entity team membership
    const query = `${this.insertMetaRowSql(config)}
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

    const result = await mutateWithRLS(query, params, userId);
    if (result.rowCount === 0) {
      throw new MetaValueTooLargeError();
    }
  }

  /**
   * Upserts a meta value merged with the stored one in a single statement, so
   * concurrent writes to the same key can't drop each other's keys the way a
   * read-merge-write in application code can. When both values are jsonb
   * objects they are merged shallowly and `precedence` decides which side
   * wins a key present in both; otherwise the winning side is kept whole.
   *
   * The 1 MiB limit applies to what gets stored, inside the same statement:
   * to the inserted value and to the merged one. When either is over it,
   * nothing is written and MetaValueTooLargeError is thrown.
   */
  private static async upsertMergedMeta(
    entityType: EntityType,
    entityId: string,
    metaKey: string,
    metaValue: unknown,
    userId: string,
    options: Partial<CreateMetaPayload>,
    precedence: 'incoming' | 'stored'
  ): Promise<void> {
    const config = this.getEntityConfig(entityType);
    const jsonString = this.validateMetaWrite(config, metaKey, metaValue);

    const stored = `"${config.metaTableName}"."metaValue"`;
    const incoming = 'EXCLUDED."metaValue"';
    const [loser, winner] = precedence === 'incoming' ? [stored, incoming] : [incoming, stored];
    const merged = `CASE
          WHEN jsonb_typeof(${stored}) = 'object' AND jsonb_typeof(${incoming}) = 'object'
          THEN ${loser} || ${winner}
          ELSE ${winner}
        END`;

    const query = `${this.insertMetaRowSql(config)}
      ON CONFLICT ("${config.idColumn}", "metaKey")
      DO UPDATE SET
        "metaValue" = ${merged},
        "dataType" = EXCLUDED."dataType",
        "isPublic" = EXCLUDED."isPublic",
        "isSearchable" = EXCLUDED."isSearchable",
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE ${this.fitsMetaLimit(merged)}
    `;
    const params = [
      entityId,
      metaKey,
      jsonString,
      options.dataType || 'json',
      options.isPublic || false,
      options.isSearchable || false
    ];

    const result = await mutateWithRLS(query, params, userId);
    if (result.rowCount === 0) {
      throw new MetaValueTooLargeError();
    }
  }

  /**
   * Sets a meta value merged into the stored one: between two jsonb objects the
   * incoming keys win and the other stored keys are kept, so a request that
   * only carries `theme` leaves `sidebarCollapsed` in place. A non-object value
   * on either side replaces the stored value, as in setEntityMeta.
   */
  static async mergeEntityMeta(
    entityType: EntityType,
    entityId: string,
    metaKey: string,
    metaValue: unknown,
    userId: string,
    options: Partial<CreateMetaPayload> = {}
  ): Promise<void> {
    await this.upsertMergedMeta(entityType, entityId, metaKey, metaValue, userId, options, 'incoming');
  }

  /**
   * Fills in default values without overwriting stored ones: between two jsonb
   * objects the stored keys win and only the missing keys are added, and a
   * stored non-object value is kept as it is. Defaults picked from a read that
   * is already stale therefore can't undo a value saved after that read.
   */
  static async mergeEntityMetaDefaults(
    entityType: EntityType,
    entityId: string,
    metaKey: string,
    metaValue: unknown,
    userId: string,
    options: Partial<CreateMetaPayload> = {}
  ): Promise<void> {
    await this.upsertMergedMeta(entityType, entityId, metaKey, metaValue, userId, options, 'stored');
  }

  /**
   * Writes each group of a nested meta payload (`{ uiPreferences: {...}, ... }`)
   * with mergeEntityMeta, or with mergeEntityMetaDefaults when `defaults` is
   * set. Entries whose value is not an object are skipped.
   */
  static async mergeEntityMetaGroups(
    entityType: EntityType,
    entityId: string,
    groups: Record<string, unknown>,
    userId: string,
    { defaults = false }: { defaults?: boolean } = {}
  ): Promise<void> {
    for (const [metaKey, metaValue] of Object.entries(groups)) {
      if (!metaValue || typeof metaValue !== 'object') continue;
      if (defaults) {
        await this.mergeEntityMetaDefaults(entityType, entityId, metaKey, metaValue, userId);
      } else {
        await this.mergeEntityMeta(entityType, entityId, metaKey, metaValue, userId);
      }
    }
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

