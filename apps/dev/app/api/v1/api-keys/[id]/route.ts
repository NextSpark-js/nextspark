/**
 * API Key Detail Routes
 * 
 * Core system endpoints for individual API key management.
 * Supports dual authentication (API Keys + Sessions).
 * 
 * Features:
 * - Get detailed API key information with usage stats
 * - Update API key name and status
 * - Revoke (soft delete) API keys
 * - Admin-only access control
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryOneWithRLS, mutateWithRLS } from '@nextsparkjs/core/lib/db';
import {
  createApiResponse,
  createApiError,
  withApiLogging,
  handleCorsPreflightRequest,
  addCorsHeaders
} from '@nextsparkjs/core/lib/api/helpers';
import { authenticateRequest, hasRequiredScope } from '@nextsparkjs/core/lib/api/auth/dual-auth';
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit';

// Handle CORS preflight
export async function OPTIONS() {
  return handleCorsPreflightRequest();
}

// GET /api/v1/api-keys/:id - Get specific API key details
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

    // Check required permissions - session users have admin access, API key users need specific scope
    const hasPermission = authResult.type === 'session' || 
      (authResult.type === 'api-key' && hasRequiredScope(authResult, 'admin:api-keys'));

    if (!hasPermission) {
      const response = createApiError('Insufficient permissions. Admin access required for API key management.', 403);
      return addCorsHeaders(response);
    }

    const { id } = await params;

    if (!id || id.trim() === '') {
      const response = createApiError('API key ID is required', 400, null, 'MISSING_API_KEY_ID');
      return addCorsHeaders(response);
    }

    const apiKey = await queryOneWithRLS(
      `SELECT id, "keyPrefix", name, scopes, status, "lastUsedAt", "expiresAt", "createdAt", "updatedAt"
       FROM "api_key" 
       WHERE id = $1 AND "userId" = $2`,
      [id, authResult.user!.id],
      authResult.user!.id
    );

    if (!apiKey) {
      const response = createApiError('API key not found', 404, null, 'API_KEY_NOT_FOUND');
      return addCorsHeaders(response);
    }

    // Get detailed usage statistics
    let usageStats: {
      total_requests: number;
      last_24h: number;
      last_7d: number;
      last_30d: number;
      avg_response_time: number;
      success_rate: number;
    } | null = null;
    
    try {
      usageStats = await queryOneWithRLS<{
        total_requests: number;
        last_24h: number;
        last_7d: number;
        last_30d: number;
        avg_response_time: number;
        success_rate: number;
      }>(
        `SELECT 
           COUNT(*) as total_requests,
           COUNT(CASE WHEN "createdAt" > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h,
           COUNT(CASE WHEN "createdAt" > NOW() - INTERVAL '7 days' THEN 1 END) as last_7d,
           COUNT(CASE WHEN "createdAt" > NOW() - INTERVAL '30 days' THEN 1 END) as last_30d,
           AVG("responseTime") as avg_response_time,
           (COUNT(CASE WHEN "statusCode" < 400 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)) as success_rate
         FROM "api_audit_log" 
         WHERE "apiKeyId" = $1`,
        [id],
        authResult.user!.id
      );
    } catch (error: unknown) {
      // If api_audit_log table doesn't exist, use default stats
      if (error && typeof error === 'object' && 'code' in error && error.code === '42P01') {
        console.warn('api_audit_log table does not exist, returning default stats');
        usageStats = null;
      } else {
        throw error;
      }
    }

    const response = createApiResponse({
      ...apiKey,
      usage_stats: usageStats || {
        total_requests: 0,
        last_24h: 0,
        last_7d: 0,
        last_30d: 0,
        avg_response_time: null,
        success_rate: null
      }
    });
    return addCorsHeaders(response);
  } catch (error) {
    console.error('Error fetching API key:', error);
    const response = createApiError('Internal server error', 500);
    return addCorsHeaders(response);
  }
}), 'strict');

// PATCH /api/v1/api-keys/:id - Update API key (only name and active status)
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

    // Check required permissions - session users have admin access, API key users need specific scope
    const hasPermission = authResult.type === 'session' || 
      (authResult.type === 'api-key' && hasRequiredScope(authResult, 'admin:api-keys'));

    if (!hasPermission) {
      const response = createApiError('Insufficient permissions. Admin access required for API key management.', 403);
      return addCorsHeaders(response);
    }

    const { id } = await params;

    if (!id || id.trim() === '') {
      const response = createApiError('API key ID is required', 400, null, 'MISSING_API_KEY_ID');
      return addCorsHeaders(response);
    }

    const body = await req.json();
    
    // Only allow updating name and status
    const allowedUpdates = ['name', 'status'];
    const updates = [];
    const values = [];
    let paramCount = 1;

    for (const field of allowedUpdates) {
      if (body[field] !== undefined) {
        if (field === 'name' && typeof body[field] !== 'string') {
          const response = createApiError('Name must be a string', 400, null, 'INVALID_NAME_TYPE');
          return addCorsHeaders(response);
        }
        if (field === 'status' && !['active', 'inactive', 'expired'].includes(body[field])) {
          const response = createApiError('status must be active, inactive, or expired', 400, null, 'INVALID_STATUS_TYPE');
          return addCorsHeaders(response);
        }
        
        updates.push(`"${field}" = $${paramCount++}`);
        values.push(body[field]);
      }
    }

    if (updates.length === 0) {
      const response = createApiError('No valid fields to update', 400, null, 'NO_FIELDS');
      return addCorsHeaders(response);
    }

    updates.push(`"updatedAt" = CURRENT_TIMESTAMP`);
    values.push(id, authResult.user!.id);

    const query = `
      UPDATE "api_key" 
      SET ${updates.join(", ")}
      WHERE id = $${paramCount} AND "userId" = $${paramCount + 1}
      RETURNING id, "keyPrefix", name, scopes, status, "lastUsedAt", "expiresAt", "createdAt", "updatedAt"
    `;

    const result = await mutateWithRLS(query, values, authResult.user!.id);

    if (result.rows.length === 0) {
      const response = createApiError('API key not found', 404, null, 'API_KEY_NOT_FOUND');
      return addCorsHeaders(response);
    }

    const response = createApiResponse(result.rows[0]);
    return addCorsHeaders(response);
  } catch (error) {
    console.error('Error updating API key:', error);
    const response = createApiError('Internal server error', 500);
    return addCorsHeaders(response);
  }
}), 'strict');

// DELETE /api/v1/api-keys/:id - Revoke API key
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

    // Check required permissions - session users have admin access, API key users need specific scope
    const hasPermission = authResult.type === 'session' || 
      (authResult.type === 'api-key' && hasRequiredScope(authResult, 'admin:api-keys'));

    if (!hasPermission) {
      const response = createApiError('Insufficient permissions. Admin access required for API key management.', 403);
      return addCorsHeaders(response);
    }

    const { id } = await params;

    if (!id || id.trim() === '') {
      const response = createApiError('API key ID is required', 400, null, 'MISSING_API_KEY_ID');
      return addCorsHeaders(response);
    }

    // For API key auth, prevent deletion of the current API key being used
    if (authResult.type === 'api-key' && 'keyId' in authResult && id === authResult.keyId) {
      const response = createApiError(
        'Cannot revoke the API key currently being used', 
        403, 
        null, 
        'SELF_REVOKE_FORBIDDEN'
      );
      return addCorsHeaders(response);
    }

    // Soft delete - just mark as inactive
    const result = await mutateWithRLS(
      `UPDATE "api_key" 
       SET status = 'inactive', "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $1 AND "userId" = $2
       RETURNING id, name`,
      [id, authResult.user!.id],
      authResult.user!.id
    );

    if (result.rows.length === 0) {
      const response = createApiError('API key not found', 404, null, 'API_KEY_NOT_FOUND');
      return addCorsHeaders(response);
    }

    const response = createApiResponse({ 
      revoked: true, 
      id,
      name: (result.rows[0] as { name: string }).name
    });
    return addCorsHeaders(response);
  } catch (error) {
    console.error('Error revoking API key:', error);
    const response = createApiError('Internal server error', 500);
    return addCorsHeaders(response);
  }
}), 'strict');