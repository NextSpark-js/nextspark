import { NextRequest, NextResponse } from 'next/server';
import { queryWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db';
import {
  createApiResponse,
  createApiError,
  parsePaginationParams,
  createPaginationMeta,
  parseFilters,
  withApiLogging,
  handleCorsPreflightRequest,
  addCorsHeaders,
  parseMetaParams,
  includeEntityMetadata,
  handleEntityMetadataInResponse,
  processEntityMetadata
} from '@nextsparkjs/core/lib/api/helpers';
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth';
import { hasAdminPermission } from '@nextsparkjs/core/lib/api/auth/permissions';
import { z } from 'zod';
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit';

const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  country: z.string().min(2, 'Country is required (minimum 2 characters)'),
  image: z.string().url('Invalid image URL format').optional(),
  language: z.string().optional().default('en'),
  timezone: z.string().optional().default('UTC'),
  role: z.enum(['member', 'colaborator']).default('member'),
  metas: z.record(z.string(), z.any()).optional()
});



// Handle CORS preflight
export async function OPTIONS() {
  return handleCorsPreflightRequest();
}

// GET /api/v1/users - List users with dual auth
export const GET = withRateLimitTier(withApiLogging(async (req: NextRequest): Promise<NextResponse> => {
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

    // SECURITY: Only superadmins can list all users
    if (!hasAdminPermission(authResult, 'users:read')) {
      const response = createApiError('Insufficient permissions. Superadmin access required.', 403);
      return addCorsHeaders(response);
    }

    const metaParams = parseMetaParams(req);
    const { page, limit, offset } = parsePaginationParams(req);
    const filters = parseFilters(req);

    // Build WHERE clause based on filters
    let whereClause = 'WHERE 1=1';
    const queryParams: (string | number)[] = [];
    let paramCount = 1;

    if (filters.role) {
      whereClause += ` AND role = $${paramCount}`;
      queryParams.push(filters.role);
      paramCount++;
    }

    // Add pagination params
    queryParams.push(limit, offset);

    const users = await queryWithRLS(
      `SELECT id, email, name, "firstName", "lastName", image, country, timezone, language, role, "emailVerified", "createdAt", "updatedAt"
       FROM "users"
       ${whereClause}
       ORDER BY "createdAt" DESC
       LIMIT $${paramCount++} OFFSET $${paramCount++}`,
      queryParams,
      authResult.user!.id
    );

    // Get total count for pagination
    const totalResult = await queryWithRLS<{ count: number }>(
      `SELECT COUNT(*) as count FROM "users" ${whereClause}`,
      queryParams.slice(0, -2), // Remove limit and offset
      authResult.user!.id
    );

    const total = totalResult[0]?.count || 0;
    const paginationMeta = createPaginationMeta(page, limit, total);

    // Include metadata if requested (usando helper compartido)
    const usersWithMeta = await includeEntityMetadata('user', users as { id: string }[], metaParams, authResult.user!.id);

    const response = createApiResponse(usersWithMeta, paginationMeta);
    return addCorsHeaders(response);
  } catch (error) {
    console.error('Error fetching users:', error);
    const response = createApiError('Internal server error', 500);
    return addCorsHeaders(response);
  }
}), 'read');

// POST /api/v1/users - Create user with dual auth
export const POST = withRateLimitTier(withApiLogging(async (req: NextRequest): Promise<NextResponse> => {
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

    // SECURITY: Only superadmins can create users
    if (!hasAdminPermission(authResult, 'users:write')) {
      const response = createApiError('Insufficient permissions. Superadmin access required.', 403);
      return addCorsHeaders(response);
    }

    const body = await req.json();
    const { metas, ...userData } = body;
    const validatedData = createUserSchema.parse(userData);
      
    // Check if email already exists
    const existingUser = await queryWithRLS(
      'SELECT id FROM "users" WHERE email = $1',
      [validatedData.email],
      authResult.user!.id
    );

    if (existingUser.length > 0) {
      const response = createApiError('Email already exists', 409, null, 'EMAIL_EXISTS');
      return addCorsHeaders(response);
    }

    const newUserId = globalThis.crypto.randomUUID();

    // Create user
    const result = await mutateWithRLS(
      `INSERT INTO "users" (id, email, "firstName", "lastName", country, image, language, timezone, role, "emailVerified")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true) RETURNING *`,
      [
        newUserId,
        validatedData.email,
        validatedData.firstName,
        validatedData.lastName,
        validatedData.country,
        validatedData.image || null,
        validatedData.language,
        validatedData.timezone,
        validatedData.role
      ],
      authResult.user!.id
    );

    const createdUser = result.rows[0];

    // Handle metadata if provided (usando helper compartido)
    const metadataWasProvided = metas && typeof metas === 'object' && Object.keys(metas).length > 0;
    
    if (metadataWasProvided) {
      await processEntityMetadata('user', newUserId, metas, authResult.user!.id);
    }

    // Crear respuesta según criterio: incluir metadata solo si se envió en el payload
    const responseData = await handleEntityMetadataInResponse('user', createdUser as { id: string }, metadataWasProvided, authResult.user!.id);
    
    const response = createApiResponse(responseData, { created: true }, 201);
    return addCorsHeaders(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const response = createApiError('Validation error', 400, error.issues, 'VALIDATION_ERROR');
      return addCorsHeaders(response);
    }
    
    console.error('Error creating user:', error);
    const response = createApiError('Internal server error', 500);
    return addCorsHeaders(response);
  }
}), 'write');

