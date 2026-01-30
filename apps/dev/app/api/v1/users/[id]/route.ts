import { NextRequest, NextResponse } from 'next/server';
import { queryOneWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db';
import {
  createApiResponse,
  createApiError,
  withApiLogging,
  handleCorsPreflightRequest,
  addCorsHeaders,
  parseMetaParams,
  includeEntityMetadataForSingle,
  handleEntityMetadataInResponse,
  processEntityMetadata
} from '@nextsparkjs/core/lib/api/helpers';
import { authenticateRequest, hasRequiredScope } from '@nextsparkjs/core/lib/api/auth/dual-auth';
import { z } from 'zod';
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit';

const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().optional(),
  language: z.string().optional(),
  role: z.enum(['member', 'superadmin']).optional(),
  metas: z.record(z.string(), z.any()).optional()
});

// Handle CORS preflight
export async function OPTIONS() {
  return handleCorsPreflightRequest();
}

// GET /api/v1/users/:id - Get specific user
export const GET = withRateLimitTier(withApiLogging(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> => {
  try {
    // Authenticate using dual auth
    const authResult = await authenticateRequest(req);
    
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: 'Authentication required', code: 'AUTHENTICATION_FAILED' },
        { status: 401 }
      );
    }

    if (authResult.rateLimitResponse) {
      return authResult.rateLimitResponse as NextResponse;
    }

    // Check required permissions - session users need admin role, API key users need specific scope
    const hasPermission = authResult.type === 'session' || 
      (authResult.type === 'api-key' && hasRequiredScope(authResult, 'users:read'));

    if (!hasPermission) {
      const response = createApiError('Insufficient permissions. Admin access required for user management.', 403);
      return addCorsHeaders(response);
    }

    const { id } = await params;

    // Validate that id is not empty
    if (!id || id.trim() === '') {
      const response = createApiError('User ID or email is required', 400, null, 'MISSING_IDENTIFIER');
      return addCorsHeaders(response);
    }

    // Search by ID or email
    const user = await queryOneWithRLS(
      'SELECT id, email, name, "firstName", "lastName", image, country, timezone, language, role, "emailVerified", "createdAt", "updatedAt" FROM "users" WHERE id = $1 OR email = $1',
      [id],
      authResult.user!.id
    );

    if (!user) {
      const response = createApiError('User not found', 404, null, 'USER_NOT_FOUND');
      return addCorsHeaders(response);
    }

    // Handle metadata if requested (usando helper compartido)
    const metaParams = parseMetaParams(req);
    const userWithMeta = await includeEntityMetadataForSingle('user', user as { id: string }, metaParams, authResult.user!.id);

    const response = createApiResponse(userWithMeta);
    return addCorsHeaders(response);
  } catch (error) {
    console.error('Error fetching user:', error);
    const response = createApiError('Internal server error', 500);
    return addCorsHeaders(response);
  }
}), 'read');

// PATCH /api/v1/users/:id - Update user
export const PATCH = withRateLimitTier(withApiLogging(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> => {
  try {
    // Authenticate using dual auth
    const authResult = await authenticateRequest(req);
    
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: 'Authentication required', code: 'AUTHENTICATION_FAILED' },
        { status: 401 }
      );
    }

    if (authResult.rateLimitResponse) {
      return authResult.rateLimitResponse as NextResponse;
    }

    // Check required permissions - session users need admin role, API key users need specific scope
    const hasPermission = authResult.type === 'session' || 
      (authResult.type === 'api-key' && hasRequiredScope(authResult, 'users:write'));

    if (!hasPermission) {
      const response = createApiError('Insufficient permissions. Admin access required for user management.', 403);
      return addCorsHeaders(response);
    }

    const { id } = await params;

    // Validate that id is not empty
    if (!id || id.trim() === '') {
      const response = createApiError('User ID or email is required', 400, null, 'MISSING_IDENTIFIER');
      return addCorsHeaders(response);
    }

    const body = await req.json();
    const { metas, ...userData } = body;
    const validatedData = updateUserSchema.parse(userData);

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (validatedData.firstName !== undefined) {
      updates.push(`"firstName" = $${paramCount++}`);
      values.push(validatedData.firstName);
    }

    if (validatedData.lastName !== undefined) {
      updates.push(`"lastName" = $${paramCount++}`);
      values.push(validatedData.lastName);
    }

    if (validatedData.language !== undefined) {
      updates.push(`language = $${paramCount++}`);
      values.push(validatedData.language);
    }

    if (validatedData.role !== undefined) {
      updates.push(`role = $${paramCount++}`);
      values.push(validatedData.role);
    }

    // Verificar si hay algo para actualizar (campos de entidad O metadatos)
    const hasEntityFieldsToUpdate = updates.length > 0;
    const hasMetadataToUpdate = metas && typeof metas === 'object' && Object.keys(metas).length > 0;
    
    if (!hasEntityFieldsToUpdate && !hasMetadataToUpdate) {
      const response = createApiError('No fields to update', 400, null, 'NO_FIELDS');
      return addCorsHeaders(response);
    }

    let updatedUser;

    if (hasEntityFieldsToUpdate) {
      // Solo actualizar campos de entidad si hay campos para actualizar
      updates.push(`"updatedAt" = CURRENT_TIMESTAMP`);
      values.push(id);

      const query = `
        UPDATE "users"
        SET ${updates.join(", ")}
        WHERE id = $${paramCount} OR email = $${paramCount}
        RETURNING id, email, name, "firstName", "lastName", image, country, timezone, language, role, "emailVerified", "createdAt", "updatedAt"
      `;

      const result = await mutateWithRLS(query, values, authResult.user!.id);

      if (result.rows.length === 0) {
        const response = createApiError('User not found', 404, null, 'USER_NOT_FOUND');
        return addCorsHeaders(response);
      }

      updatedUser = result.rows[0];
    } else {
      // Solo metadata a actualizar - obtener usuario existente
      const user = await queryOneWithRLS(
        'SELECT id, email, name, "firstName", "lastName", image, country, timezone, language, role, "emailVerified", "createdAt", "updatedAt" FROM "users" WHERE id = $1 OR email = $1',
        [id],
        authResult.user!.id
      );

      if (!user) {
        const response = createApiError('User not found', 404, null, 'USER_NOT_FOUND');
        return addCorsHeaders(response);
      }

      updatedUser = user;
    }

    // Handle metadata if provided (usando helper compartido)
    const metadataWasProvided = metas && typeof metas === 'object' && Object.keys(metas).length > 0;
    
    if (metadataWasProvided) {
      await processEntityMetadata('user', (updatedUser as { id: string }).id, metas, authResult.user!.id);
    }

    // Crear respuesta según criterio: incluir metadata solo si se envió en el payload
    const responseData = await handleEntityMetadataInResponse('user', updatedUser as { id: string }, metadataWasProvided, authResult.user!.id);

    const response = createApiResponse(responseData);
    return addCorsHeaders(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const response = createApiError('Validation error', 400, error.issues, 'VALIDATION_ERROR');
      return addCorsHeaders(response);
    }
    
    console.error('Error updating user:', error);
    const response = createApiError('Internal server error', 500);
    return addCorsHeaders(response);
  }
}), 'write');

// DELETE /api/v1/users/:id - Delete user
export const DELETE = withRateLimitTier(withApiLogging(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> => {
  try {
    // Authenticate using dual auth
    const authResult = await authenticateRequest(req);
    
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: 'Authentication required', code: 'AUTHENTICATION_FAILED' },
        { status: 401 }
      );
    }

    if (authResult.rateLimitResponse) {
      return authResult.rateLimitResponse as NextResponse;
    }

    // Check required permissions - session users need admin role, API key users need specific scope
    const hasPermission = authResult.type === 'session' || 
      (authResult.type === 'api-key' && hasRequiredScope(authResult, 'users:delete'));

    if (!hasPermission) {
      const response = createApiError('Insufficient permissions. Admin access required for user management.', 403);
      return addCorsHeaders(response);
    }

    const { id } = await params;

    // Validate that id is not empty
    if (!id || id.trim() === '') {
      const response = createApiError('User ID or email is required', 400, null, 'MISSING_IDENTIFIER');
      return addCorsHeaders(response);
    }

    // First, get the user to check if it exists and prevent self-deletion
    const targetUser = await queryOneWithRLS(
      'SELECT id, email FROM "users" WHERE id = $1 OR email = $1',
      [id],
      authResult.user!.id
    );

    if (!targetUser) {
      const response = createApiError('User not found', 404, null, 'USER_NOT_FOUND');
      return addCorsHeaders(response);
    }

    // Prevent self-deletion
    if ((targetUser as Record<string, unknown>).id === authResult.user!.id) {
      const response = createApiError('Cannot delete your own account via API', 403, null, 'SELF_DELETE_FORBIDDEN');
      return addCorsHeaders(response);
    }

    const result = await mutateWithRLS(
      'DELETE FROM "users" WHERE id = $1 RETURNING id',
      [(targetUser as Record<string, unknown>).id],
      authResult.user!.id
    );

    if (result.rows.length === 0) {
      const response = createApiError('User not found', 404, null, 'USER_NOT_FOUND');
      return addCorsHeaders(response);
    }

    const response = createApiResponse({ deleted: true, id });
    return addCorsHeaders(response);
  } catch (error) {
    console.error('Error deleting user:', error);
    const response = createApiError('Internal server error', 500);
    return addCorsHeaders(response);
  }
}), 'write');
