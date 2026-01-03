import { MetaService } from '../services/meta.service';
import { EntityType } from '../../types/meta.types';

/**
 * Decorador genérico para agregar meta datos a entidades
 */
export async function withMeta<T extends { id: string }>(
  entities: T | T[],
  entityType: EntityType,
  userId: string,
  includePrivate: boolean = false
): Promise<(T & { meta: Record<string, unknown> }) | (T & { meta: Record<string, unknown> })[]> {
  const isArray = Array.isArray(entities);
  const entityList = isArray ? entities : [entities];

  const entitiesWithMeta = await Promise.all(
    entityList.map(async (entity) => {
      const meta = await MetaService.getEntityMetas(
        entityType,
        entity.id,
        userId,
        includePrivate
      );

      return {
        ...entity,
        meta
      };
    })
  );

  return isArray ? entitiesWithMeta : entitiesWithMeta[0];
}

/**
 * Copiar meta datos de una entidad a otra
 */
export async function copyEntityMetas(
  entityType: EntityType,
  sourceEntityId: string,
  targetEntityId: string,
  userId: string,
  metaKeys?: string[]
): Promise<void> {
  const sourceMetas = await MetaService.getEntityMetas(entityType, sourceEntityId, userId, true);
  
  const metasToCopy = metaKeys 
    ? Object.fromEntries(Object.entries(sourceMetas).filter(([key]) => metaKeys.includes(key)))
    : sourceMetas;

  if (Object.keys(metasToCopy).length > 0) {
    await MetaService.setBulkEntityMetas(entityType, targetEntityId, metasToCopy, userId);
  }
}

/**
 * Validación básica de metadata - solo tipos básicos
 * Sin schemas predefinidos, solo validaciones mínimas
 */
export function validateBasicMetas(
  metas: Record<string, unknown>
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [key, value] of Object.entries(metas)) {
    // Validaciones básicas
    if (!key || key.trim() === '') {
      errors.push('Meta key cannot be empty');
    }
    
    if (key.length > 100) {
      errors.push(`Meta key '${key}' is too long (max 100 characters)`);
    }
    
    // Validar tamaño del valor
    try {
      const valueSize = JSON.stringify(value).length;
      if (valueSize > 1048576) { // 1MB
        errors.push(`Meta value for '${key}' is too large (max 1MB)`);
      }
    } catch {
      errors.push(`Meta value for '${key}' is not serializable`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}