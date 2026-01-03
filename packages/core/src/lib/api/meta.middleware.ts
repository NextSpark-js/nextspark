import { NextRequest, NextResponse } from 'next/server';
import { MetaService } from '../services/meta.service';
import { validateBasicMetas } from '../helpers/entity-meta.helpers';
import { EntityType } from '../../types/meta.types';

// Definir tipos para el contexto
interface RouteContext {
  params: Promise<{ id: string; [key: string]: string }>;
}

/**
 * Middleware que procesa meta datos en endpoints existentes
 */
export function withUnifiedMeta(entityType: EntityType) {
  return function <T extends { id: string }>(
    handler: (req: NextRequest, context: RouteContext) => Promise<NextResponse | T | T[]>
  ) {
    return async function (req: NextRequest, context: RouteContext) {
      const method = req.method;
      
      if (method === 'GET') {
        return handleGetWithMeta(req, context, handler, entityType);
      } else if (method === 'PUT' || method === 'PATCH' || method === 'POST') {
        return handleUpdateWithMeta(req, context, handler, entityType);
      } else {
        return handler(req, context);
      }
    };
  };
}

/**
 * Maneja GET requests con meta datos opcionales
 */
async function handleGetWithMeta<T extends { id: string }>(
  req: NextRequest,
  context: RouteContext,
  handler: (req: NextRequest, context: RouteContext) => Promise<NextResponse | T | T[]>,
  entityType: EntityType
) {
  // Ejecutar handler original
  const result = await handler(req, context);
  
  // Verificar si se debe incluir meta datos
  const includeMeta = parseIncludeMetaParam(req);
  if (!includeMeta) {
    return result;
  }

  // Obtener userId del contexto de autenticación
  const userId = (req as { auth?: { userId: string } }).auth?.userId;
  if (!userId) {
    return result;
  }

  const includePrivate = req.nextUrl.searchParams.get('includePrivate') === 'true';

  // Agregar meta datos al resultado
  // Solo enriquecer si el resultado es un objeto/array válido con id
  if (result instanceof NextResponse) {
    return result;
  }
  
  return await enrichWithMeta(result as T | T[], entityType, userId, includeMeta, includePrivate);
}

/**
 * Maneja PUT/PATCH/POST requests con meta datos en el body
 */
async function handleUpdateWithMeta<T extends { id: string }>(
  req: NextRequest,
  context: RouteContext,
  handler: (req: NextRequest, context: RouteContext) => Promise<NextResponse | T | T[]>,
  entityType: EntityType
) {
  const body = await req.clone().json();
  const userId = (req as { auth?: { userId: string } }).auth?.userId;
  
  // Separar meta datos del body principal
  const { meta, ...entityData } = body;
  
  let result;
  
  // Determinar si es una actualización solo de meta datos
  const isMetaOnlyUpdate = meta && Object.keys(entityData).length === 0;
  
  if (isMetaOnlyUpdate) {
    // Solo meta datos: obtener la entidad existente para el response
    const params = await context.params;
    const id = params.id;
    if (!userId) {
      throw new Error('User authentication required for metadata updates');
    }
    result = await getExistingEntity(entityType, id, userId);
  } else {
    // Actualización normal: crear nuevo request sin meta datos para el handler original
    const modifiedReq = createModifiedRequest(req, entityData);
    result = await handler(modifiedReq, context);
  }

  // Procesar meta datos si están presentes
  if (meta && userId) {
    const entityId = typeof result === 'object' && 'id' in result ? result.id : await extractEntityId(context);
    
    // Validar meta datos básicos
    const validation = validateBasicMetas(meta);
    if (!validation.isValid) {
      throw new Error(`Meta validation failed: ${validation.errors.join(', ')}`);
    }

    // Actualizar meta datos
    await MetaService.setBulkEntityMetas(entityType, entityId, meta, userId);

    // Si se solicita incluir meta datos en el response
    const includeMeta = parseIncludeMetaParam(req);
    if (includeMeta && !(result instanceof NextResponse)) {
      result = await enrichWithMeta(result as T | T[], entityType, userId, includeMeta, false);
    }
  }

  return result;
}

/**
 * Parsea el parámetro include_meta del query string
 */
function parseIncludeMetaParam(req: NextRequest): string[] | boolean | null {
  const includeMetaParam = req.nextUrl.searchParams.get('includeMeta');
  
  if (!includeMetaParam || includeMetaParam === 'false') {
    return null;
  }
  
  if (includeMetaParam === 'true' || includeMetaParam === 'all') {
    return true; // Incluir todos los meta datos
  }
  
  // Lista específica de meta keys
  return includeMetaParam.split(',').map(key => key.trim());
}

/**
 * Enriquece el resultado con meta datos
 */
async function enrichWithMeta<T extends { id: string }>(
  result: T | T[],
  entityType: EntityType,
  userId: string,
  includeMeta: string[] | boolean,
  includePrivate: boolean
): Promise<T | T[]> {
  const isArray = Array.isArray(result);
  const entities = isArray ? result : [result];

  const enrichedEntities = await Promise.all(
    entities.map(async (entity) => {
      let meta: Record<string, unknown>;
      
      if (includeMeta === true) {
        // Incluir todos los meta datos
        meta = await MetaService.getEntityMetas(entityType, entity.id, userId, includePrivate);
      } else if (Array.isArray(includeMeta)) {
        // Incluir solo meta datos específicos
        meta = await MetaService.getSpecificEntityMetas(entityType, entity.id, includeMeta, userId);
      } else {
        meta = {};
      }

      return {
        ...entity,
        meta
      };
    })
  );

  return isArray ? enrichedEntities : enrichedEntities[0];
}

/**
 * Crea un request modificado sin meta datos para el handler original
 */
function createModifiedRequest(originalReq: NextRequest, entityData: unknown): NextRequest {
  const newBody = JSON.stringify(entityData);
  
  return new NextRequest(originalReq.url, {
    method: originalReq.method,
    headers: originalReq.headers,
    body: newBody,
  });
}

/**
 * Obtiene una entidad existente (para casos de actualizaciones automáticas de meta datos)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getExistingEntity(entityType: EntityType, entityId: string, userId: string) {
  // Implementación específica según el tipo de entidad
  // Por simplicidad, retornamos un objeto básico
  // Los parámetros entityType y userId se usarán en futuras implementaciones específicas
  return { id: entityId };
}

/**
 * Extrae el ID de entidad del contexto
 */
async function extractEntityId(context: RouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

