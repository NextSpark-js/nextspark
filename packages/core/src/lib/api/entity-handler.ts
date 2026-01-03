/**
 * Entity Route Handler
 * 
 * Base handler for entity API routes with automatic permission checking,
 * field filtering, and standardized responses.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { CRUDOperation, EntityConfig } from '../entities/types';
// Permission system removed - using basic auth now
import { auth } from '../auth';
import { entityRegistry, ensureInitialized } from '../entities/registry';
import {
  createApiResponse,
  createApiError,
  parsePaginationParams,
  createPaginationMeta,
  parseMetaParams,
  includeEntityMetadata,
  processEntityMetadata,
  handleEntityMetadataInResponse
} from './helpers';
import { afterEntityCreate, afterEntityUpdate, afterEntityDelete } from '../entities/entity-hooks';

/**
 * Entity handler context
 */
export interface EntityHandlerContext {
  user: {
    id: string;
    email: string;
    role: string;
  };
  entity: EntityConfig;
  request: NextRequest;
  pagination?: {
    page: number;
    limit: number;
    offset: number;
  };
}

/**
 * Entity handler options
 */
export interface EntityHandlerOptions {
  allowMetadata?: boolean;
  customValidation?: (context: EntityHandlerContext) => Promise<{ valid: boolean; error?: string }>;
}

/**
 * Simple auth check - replaces permission system
 */
async function checkBasicAuth(request: NextRequest, entityName: string) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    
    if (!session) {
      return {
        allowed: false,
        response: createApiError('Authentication required', 401)
      };
    }

    // Get entity config
    await ensureInitialized();
    const entity = entityRegistry.get(entityName);
    if (!entity) {
      return {
        allowed: false,
        response: createApiError('Entity not found', 404)
      };
    }

    return {
      allowed: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role || 'user'
      },
      entity
    };
  } catch {
    return {
      allowed: false,
      response: createApiError('Authentication failed', 401)
    };
  }
}

/**
 * CRUD handler functions
 */
export interface EntityCRUDHandlers {
  list?: (context: EntityHandlerContext) => Promise<{
    data: Array<Record<string, unknown>>;
    total: number;
  }>;
  create?: (context: EntityHandlerContext, data: Record<string, unknown>) => Promise<Record<string, unknown>>;
  read?: (context: EntityHandlerContext, id: string) => Promise<Record<string, unknown> | null>;
  update?: (context: EntityHandlerContext, id: string, data: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  delete?: (context: EntityHandlerContext, id: string) => Promise<boolean>;
}

/**
 * Legacy function - use createEntityListHandlers or createEntityDetailHandlers instead
 * @deprecated
 */
export function createEntityHandlers(
  entityName: string,
  handlers: EntityCRUDHandlers,
  options: EntityHandlerOptions = {}
) {
  console.warn(`createEntityHandlers is deprecated. Use createEntityListHandlers or createEntityDetailHandlers instead for ${entityName}`);
  return createEntityListHandlers(entityName, handlers, options);
}

/**
 * Wrapper for entity auth - simplified without permissions
 */
export function withEntityAuth(
  entityName: string,
  action: CRUDOperation,
  options: EntityHandlerOptions = {}
) {
  return function<T extends unknown[]>(
    handler: (context: EntityHandlerContext, ...args: T) => Promise<NextResponse>
  ) {
    return async function(request: NextRequest, ...args: T): Promise<NextResponse> {
      try {
        // Check basic authentication
        const authCheck = await checkBasicAuth(request, entityName);
        
        if (!authCheck.allowed) {
          return authCheck.response!;
        }

        // Create context
        const context: EntityHandlerContext = {
          user: authCheck.user!,
          entity: authCheck.entity!,
          request
        };

        // Add pagination for list operations
        if (action === 'read' && request.method === 'GET') {
          context.pagination = parsePaginationParams(request);
        }

        // Custom validation if provided
        if (options.customValidation) {
          const validationResult = await options.customValidation(context);
          if (!validationResult.valid) {
            return createApiError(
              validationResult.error || 'Custom validation failed',
              400
            );
          }
        }

        // Call the handler
        return await handler(context, ...args);
      } catch (error) {
        console.error(`Error in ${entityName} ${action} handler:`, error);
        return createApiError(
          'Internal server error',
          500,
          process.env.NODE_ENV === 'development' ? error : undefined
        );
      }
    };
  };
}

/**
 * Create standardized CRUD handlers for an entity (list and create only)
 */
export function createEntityListHandlers(
  entityName: string,
  handlers: EntityCRUDHandlers,
  options: EntityHandlerOptions = {}
) {
  
  // GET handler for list routes (no [id] parameter)
  async function GET(request: NextRequest) {
    const authCheck = await checkBasicAuth(request, entityName);
    
    if (!authCheck.allowed) {
      return authCheck.response!;
    }

    const user = authCheck.user!;
    const entity = authCheck.entity!;
    
    // Create context with pagination for list operations
    const handlerContext: EntityHandlerContext = {
      user,
      entity,
      request,
      pagination: parsePaginationParams(request)
    };

    try {
      // List items
      if (!handlers.list) {
        return createApiError('List operation not supported', 404);
      }

      const result = await handlers.list(handlerContext);
      const { data, total } = result;

      // Handle metadata inclusion
      const metaParams = parseMetaParams(request);
      let dataWithMeta = data;
      if (options.allowMetadata && metaParams.includeMetadata) {
        dataWithMeta = await includeEntityMetadata(
          entityName, 
          data as Array<{ id: string }>, 
          metaParams, 
          user.id
        );
      }

      // Create pagination meta
      const pagination = handlerContext.pagination;
      const paginationMeta = pagination ? 
        createPaginationMeta(pagination.page, pagination.limit, total) : 
        {};

      return createApiResponse(dataWithMeta, paginationMeta);
    } catch (error) {
      console.error(`Error in ${entityName} GET handler:`, error);
      return createApiError(
        'Internal server error',
        500,
        process.env.NODE_ENV === 'development' ? error : undefined
      );
    }
  }

  // POST handler (create)
  async function POST(request: NextRequest) {
    const authCheck = await checkBasicAuth(request, entityName);
    
    if (!authCheck.allowed) {
      return authCheck.response!;
    }

    const user = authCheck.user!;
    const entity = authCheck.entity!;
    
    const handlerContext: EntityHandlerContext = {
      user,
      entity,
      request
    };

    try {
      if (!handlers.create) {
        return createApiError('Create operation not supported', 405);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return createApiError('Invalid JSON body', 400);
      }

      // Separate metadata from main entity data
      const { metas, ...entityData } = body;

      // Create the entity
      const createdItem = await handlers.create(handlerContext, entityData);

      // Fire entity hooks for plugins to react
      try {
        await afterEntityCreate(entityName, createdItem, user.id);
      } catch (hookError) {
        console.error(`[entity-handler] Error in afterEntityCreate hook for ${entityName}:`, hookError);
        // Don't fail the request if hooks fail
      }

      // Handle metadata if provided
      const metadataWasProvided = metas && typeof metas === 'object' && Object.keys(metas).length > 0;
      if (metadataWasProvided && options.allowMetadata) {
        await processEntityMetadata(entityName, (createdItem as { id: string }).id, metas, user.id);
      }

      // Create response with metadata if provided in payload
      let responseData = createdItem;
      if (options.allowMetadata) {
        responseData = await handleEntityMetadataInResponse(
          entityName, 
          createdItem as { id: string }, 
          metadataWasProvided, 
          user.id
        );
      }

      return createApiResponse(responseData, {}, 201);
    } catch (error) {
      console.error(`Error in ${entityName} POST handler:`, error);
      return createApiError(
        'Internal server error',
        500,
        process.env.NODE_ENV === 'development' ? error : undefined
      );
    }
  }

  return {
    GET,
    POST
  };
}

/**
 * Create standardized CRUD handlers for entity detail routes (with [id])
 */
export function createEntityDetailHandlers(
  entityName: string,
  handlers: EntityCRUDHandlers,
  options: EntityHandlerOptions = {}
) {
  
  // GET handler for detail routes (with [id] parameter)
  async function GET(request: NextRequest, routeContext: { params: Promise<{ id: string }> }) {
    const authCheck = await checkBasicAuth(request, entityName);
    
    if (!authCheck.allowed) {
      return authCheck.response!;
    }

    const user = authCheck.user!;
    const entity = authCheck.entity!;
    
    // Handle params (Next.js 15 always provides Promise)
    const params = await routeContext.params;
    const { id } = params;
    
    // Create context
    const handlerContext: EntityHandlerContext = {
      user,
      entity,
      request
    };

    try {
      // Single item read
      if (!handlers.read) {
        return createApiError('Read operation not supported', 404);
      }

      const item = await handlers.read(handlerContext, id);
      
      if (!item) {
        return createApiError('Item not found', 404);
      }

      // Handle metadata inclusion
      const metaParams = parseMetaParams(request);
      let itemWithMeta = item;
      if (options.allowMetadata && metaParams.includeMetadata) {
        const items = await includeEntityMetadata(
          entityName, 
          [item as { id: string }], 
          metaParams, 
          user.id
        );
        itemWithMeta = items[0] || item;
      }

      return createApiResponse(itemWithMeta);
    } catch (error) {
      console.error(`Error in ${entityName} GET handler:`, error);
      return createApiError(
        'Internal server error',
        500,
        process.env.NODE_ENV === 'development' ? error : undefined
      );
    }
  }

  // PATCH handler (update)
  async function PATCH(request: NextRequest, routeContext: { params: Promise<{ id: string }> }) {
    const authCheck = await checkBasicAuth(request, entityName);
    
    if (!authCheck.allowed) {
      return authCheck.response!;
    }

    const user = authCheck.user!;
    const entity = authCheck.entity!;
    
    // Handle params (Next.js 15 always provides Promise)
    const params = await routeContext.params;
    const { id } = params;
    
    const handlerContext: EntityHandlerContext = {
      user,
      entity,
      request
    };

    try {
      if (!handlers.update) {
        return createApiError('Update operation not supported', 405);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return createApiError('Invalid JSON body', 400);
      }

      // Separate metadata from main entity data
      const { metas, ...entityData } = body;

      // Update the entity
      const updatedItem = await handlers.update(handlerContext, id, entityData);

      if (!updatedItem) {
        return createApiError('Item not found', 404);
      }

      // Fire entity hooks for plugins to react
      try {
        await afterEntityUpdate(entityName, id, updatedItem, entityData, user.id);
      } catch (hookError) {
        console.error(`[entity-handler] Error in afterEntityUpdate hook for ${entityName}:`, hookError);
        // Don't fail the request if hooks fail
      }

      // Handle metadata if provided
      const metadataWasProvided = metas && typeof metas === 'object' && Object.keys(metas).length > 0;
      if (metadataWasProvided && options.allowMetadata) {
        await processEntityMetadata(entityName, id, metas, user.id);
      }

      // Create response with metadata if provided in payload
      let responseData = updatedItem;
      if (options.allowMetadata) {
        responseData = await handleEntityMetadataInResponse(
          entityName, 
          updatedItem as { id: string }, 
          metadataWasProvided, 
          user.id
        );
      }

      return createApiResponse(responseData);
    } catch (error) {
      console.error(`Error in ${entityName} PATCH handler:`, error);
      return createApiError(
        'Internal server error',
        500,
        process.env.NODE_ENV === 'development' ? error : undefined
      );
    }
  }

  // DELETE handler
  async function DELETE(request: NextRequest, routeContext: { params: Promise<{ id: string }> }) {
    const authCheck = await checkBasicAuth(request, entityName);
    
    if (!authCheck.allowed) {
      return authCheck.response!;
    }

    const user = authCheck.user!;
    const entity = authCheck.entity!;
    
    // Handle params (Next.js 15 always provides Promise)
    const params = await routeContext.params;
    const { id } = params;
    
    const handlerContext: EntityHandlerContext = {
      user,
      entity,
      request
    };

    try {
      if (!handlers.delete) {
        return createApiError('Delete operation not supported', 405);
      }

      const success = await handlers.delete(handlerContext, id);

      if (!success) {
        return createApiError('Item not found', 404);
      }

      // Fire entity hooks for plugins to react
      try {
        await afterEntityDelete(entityName, id, user.id);
      } catch (hookError) {
        console.error(`[entity-handler] Error in afterEntityDelete hook for ${entityName}:`, hookError);
        // Don't fail the request if hooks fail
      }

      return createApiResponse({ success: true, id });
    } catch (error) {
      console.error(`Error in ${entityName} DELETE handler:`, error);
      return createApiError(
        'Internal server error',
        500,
        process.env.NODE_ENV === 'development' ? error : undefined
      );
    }
  }

  return {
    GET,
    PATCH,
    DELETE
  };
}

/**
 * Simple wrapper for single-action handlers
 */
export function withEntityAction(
  entityName: string,
  action: CRUDOperation,
  options: EntityHandlerOptions = {}
) {
  return withEntityAuth(entityName, action, options);
}

/**
 * Helper to create database query context with RLS
 */
export function createQueryContext(context: EntityHandlerContext) {
  return {
    userId: context.user.id,
    userRole: context.user.role,
    userFlags: [],
    entityConfig: context.entity
  };
}